export enum CommandPriority {
    LOW = 0,
    STANDARD = 1,
    HIGH = 2,
    CRITICAL_KILL_SWITCH = 99
}

interface QueuedCommand {
    internalDeviceId: string;
    command: string;
    payload?: any;
    priority: CommandPriority;
    retryCount: number;
}
import { BaseDeviceProvider, IotDeviceState } from './providers/BaseDeviceProvider';
import { MqttProvider } from './providers/MqttProvider';
import { TuyaProvider } from './providers/TuyaProvider';
import { PowerIntelligenceEngine } from './engine/PowerIntelligenceEngine';

export class IoTGateway {
    private providers: Map<string, BaseDeviceProvider> = new Map();
    // Maps our internal DB UUID to { providerName, providerDeviceId }
    private deviceRegistry: Map<string, { provider: string, providerDeviceId: string }> = new Map();
    private powerEngine: PowerIntelligenceEngine;
    // Idempotency cache for deduplication
    private commandCache: Set<string> = new Set();
    private priorityQueue: QueuedCommand[] = [];
    private isProcessingQueue = false;
    // Retry tracking Map<internalDeviceId, timeoutHandle>
    private retryQueue: Map<string, any> = new Map();

    constructor() {
        this.registerProvider(new MqttProvider());
        this.registerProvider(new TuyaProvider());
        this.powerEngine = new PowerIntelligenceEngine(this);
    }

    private registerProvider(provider: BaseDeviceProvider) {
        this.providers.set(provider.providerName, provider);
        
        // Listen to all asynchronous telemetry from this provider
        provider.onTelemetry((providerDeviceId, state) => {
            this.handleIncomingTelemetry(provider.providerName, providerDeviceId, state);
        });
    }

    async start() {
        console.log('[IoTGateway] Initializing Universal Provider Layer...');
        for (const provider of this.providers.values()) {
            await provider.connect();
        }
        console.log('[IoTGateway] Universal Provider Layer Ready.');
    }

    /**
     * Bind a new hardware device to the platform
     */
    async registerDevice(internalDeviceId: string, providerName: string, credentials: any) {
        const provider = this.providers.get(providerName);
        if (!provider) throw new Error(`Unknown provider: ${providerName}`);

        const providerDeviceId = await provider.bindDevice(credentials);
        this.deviceRegistry.set(internalDeviceId, { provider: providerName, providerDeviceId });
        console.log(`[IoTGateway] Registered internal device ${internalDeviceId} to ${providerName}:${providerDeviceId}`);
    }

    /**
     * Inspects actual hardware connectivity status
     */
    async getDeviceStatus(internalDeviceId: string): Promise<IotDeviceState> {
        const mapping = this.deviceRegistry.get(internalDeviceId);
        if (!mapping) {
            return {
                status: 'offline',
                isRunning: false,
                lastHeartbeat: new Date(0),
                rawPayload: { error: 'DEVICE_NOT_FOUND_IN_REGISTRY' }
            };
        }
        const provider = this.providers.get(mapping.provider);
        if (!provider) {
            return {
                status: 'offline',
                isRunning: false,
                lastHeartbeat: new Date(0),
                rawPayload: { error: 'PROVIDER_NOT_LOADED' }
            };
        }
        return await provider.getStatus(mapping.providerDeviceId);
    }


    /**
     * Asynchronous Command Pipeline.
     * This pushes a command to the queue, fires it off to the provider, and awaits telemetry verification.
     */
        async executeCommand(internalDeviceId: string, command: string, payload?: any, retryCount: number = 0, priority: CommandPriority = CommandPriority.STANDARD): Promise<void> {
        // 1. CRITICAL BYPASS
        if (priority === CommandPriority.CRITICAL_KILL_SWITCH) {
            console.log(`[IoTGateway] 🚨 CRITICAL PRIORITY: Bypassing DLQ and Queues for ${command} to ${internalDeviceId}`);
            await this.dispatchToProvider(internalDeviceId, command, payload, retryCount);
            return;
        }

        // 2. Standard Queueing
        this.priorityQueue.push({ internalDeviceId, command, payload, priority, retryCount });
        
        // Sort by priority descending
        this.priorityQueue.sort((a, b) => b.priority - a.priority);
        
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    private async processQueue() {
        this.isProcessingQueue = true;
        while (this.priorityQueue.length > 0) {
            const nextCmd = this.priorityQueue.shift();
            if (nextCmd) {
                await this.dispatchToProvider(nextCmd.internalDeviceId, nextCmd.command, nextCmd.payload, nextCmd.retryCount);
                // Introduce small 50ms delay to prevent rate-limiting downstream
                await new Promise(res => setTimeout(res, 50));
            }
        }
        this.isProcessingQueue = false;
    }

    private async dispatchToProvider(internalDeviceId: string, command: string, payload?: any, retryCount: number = 0): Promise<void> {
        // 1. Idempotency Check
        const idempotencyKey = `${internalDeviceId}_${command}_${Date.now() / 5000 | 0}`; // Dedupe within 5 seconds
        if (this.commandCache.has(idempotencyKey) && retryCount === 0) {
            console.warn(`[IoTGateway] DEDUPLICATED command ${command} for ${internalDeviceId}`);
            return;
        }
        if (retryCount === 0) this.commandCache.add(idempotencyKey);

        const mapping = this.deviceRegistry.get(internalDeviceId);
        if (!mapping) throw new Error('Device not registered in gateway memory');
        const provider = this.providers.get(mapping.provider);
        if (!provider) throw new Error('Provider not loaded');

        // 2. Event Sourcing DB Logging
        console.log(`[IoTGateway] [Event Sourcing] Logging COMMAND_ISSUED: ${command} for ${internalDeviceId}`);

        // 3. Dispatch
        const success = await provider.sendCommand(mapping.providerDeviceId, command, payload);
        if (!success) {
            console.error(`[IoTGateway] Provider dispatch failed. Event Sourcing: FAULT_DETECTED`);
            return;
        }

        console.log(`[IoTGateway] Dispatched (Retry ${retryCount}). Awaiting async telemetry verification...`);

        // 4. Retry Engine (Fail-safe timeout)
        if (this.retryQueue.has(internalDeviceId)) {
            clearTimeout(this.retryQueue.get(internalDeviceId));
        }

        const timeout = setTimeout(() => {
            console.warn(`[IoTGateway] 🚨 TIMEOUT: No async telemetry received for ${internalDeviceId} after command ${command}`);
            if (retryCount < 3) {
                console.log(`[IoTGateway] Initiating Retry ${retryCount + 1} for ${internalDeviceId}`);
                this.executeCommand(internalDeviceId, command, payload, retryCount + 1, CommandPriority.HIGH); // Retry at high priority
            } else {
                console.error(`[IoTGateway] 🚨 SRE FATAL: Command ${command} permanently failed after 3 retries.`);
                // Broadcast fault to Android
                this.broadcastWebSocketUpdate(internalDeviceId, { status: 'fault', isRunning: false, lastHeartbeat: new Date(), rawPayload: { error: 'TELEMETRY_TIMEOUT' } });
            }
        }, 15000); // 15 second SRE timeout

        this.retryQueue.set(internalDeviceId, timeout);
    }

    /**
     * Core Telemetry Ingestion Engine
     */
    private handleIncomingTelemetry(providerName: string, providerDeviceId: string, state: IotDeviceState) {
        // Find internal ID
        let internalDeviceId: string | null = null;
        for (const [id, mapping] of this.deviceRegistry.entries()) {
            if (mapping.provider === providerName && mapping.providerDeviceId === providerDeviceId) {
                internalDeviceId = id;
                break;
            }
        }

        if (!internalDeviceId) {
            console.warn(`[IoTGateway] Telemetry received for unknown device ${providerName}:${providerDeviceId}`);
            return;
        }

        console.log(`[IoTGateway] Real-time Telemetry for ${internalDeviceId}: Motor=${state.isRunning}, Amps=${state.amperage}`);

        // 1. Save telemetry to TimescaleDB / Postgres `iot_telemetry_logs`
        
        // Clear any pending Retry Timeouts since telemetry arrived
        if (this.retryQueue.has(internalDeviceId)) {
            clearTimeout(this.retryQueue.get(internalDeviceId));
            this.retryQueue.delete(internalDeviceId);
            console.log(`[IoTGateway] Async telemetry received. Cleared Retry Queue for ${internalDeviceId}`);
        }

        // Event Sourcing Log
        // SQL: INSERT INTO device_events (event_type) VALUES ('TELEMETRY_RECEIVED')

        // SRE: Run Power Intelligence Protection
        this.powerEngine.evaluateTelemetry(internalDeviceId, state);

        // State Verification
        if (state.status !== 'fault' && state.isRunning && state.amperage && state.amperage > 1.0) {
            console.log(`[IoTGateway] HARDWARE VERIFIED: ${state.amperage}A. Logging STATE_CONFIRMED.`);
        } else if (state.isRunning && state.amperage && state.amperage <= 0.1) {
            console.warn(`[IoTGateway] FAULT DETECTED: Dry Run (0A). Logging FAULT_DETECTED.`);
            state.status = 'fault';
        }

        // 3. Broadcast to Android App via WebSockets
        this.broadcastWebSocketUpdate(internalDeviceId, state);
        
        // 4. Trigger Rule Engine (e.g. if moisture < 30%, start motor)
        // RuleEngine.evaluate(internalDeviceId, state);
    }

    private broadcastWebSocketUpdate(deviceId: string, state: IotDeviceState) {
        // In reality, emit to Socket.io or ws clients subscribed to this device
        console.log(`[WebSocket -> App] { "device": "${deviceId}", "status": "${state.status}", "isRunning": ${state.isRunning} }`);
    }
}
