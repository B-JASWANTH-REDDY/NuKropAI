import { FastifyInstance } from 'fastify';
import { IoTGateway } from '../iot/Gateway';
import { pool } from '../config/db';
import { authenticate } from '../middleware/auth';

const gateway = new IoTGateway();

// Start the gateway immediately to bind to MQTT/Tuya providers
gateway.start().catch(console.error);

export default async function iotRoutes(fastify: FastifyInstance) {
    
    // 1. WebSocket Endpoint for Real-time App Telemetry
    (fastify as any).get('/telemetry/stream', { websocket: true }, (connection: any, req: any) => {
        const query = (req?.query || {}) as { deviceId?: string };
        fastify.log.info(`[WebSocket] Client connected for device: ${query.deviceId || 'ALL'}`);
        
        if (connection?.socket?.send) {
            connection.socket.send(JSON.stringify({ event: 'connected', message: 'NuKrop IoT Stream Active' }));
        }
        
        if (connection?.socket?.on) {
            connection.socket.on('message', (message: any) => {
                console.log('Received WebSocket message:', message?.toString());
            });
        }
    });

    // 2. Add / Bind New Device (Authentic Farmer & Provider Verification)
    fastify.post('/devices/bind', { preHandler: [authenticate] }, async (request, reply) => {
        const { provider, providerDeviceId, credentials, deviceName } = request.body as any;
        const callerId = request.user?.id;
        
        if (!callerId) {
            return reply.status(401).send({ 
                status: 'error', 
                message: 'Authentication required: Verified authentication token is missing or invalid.' 
            });
        }

        // Verify provider configuration before attempting hardware bind
        if (provider === 'tuya' && (!process.env.TUYA_CLIENT_ID || !process.env.TUYA_SECRET)) {
            return reply.status(400).send({
                status: 'error',
                code: 'PROVIDER_NOT_CONFIGURED',
                message: 'Tuya Cloud API credentials are not configured on the server. Please set TUYA_CLIENT_ID and TUYA_SECRET.'
            });
        }

        if (provider === 'mqtt' && !process.env.MQTT_BROKER_URL) {
            return reply.status(400).send({
                status: 'error',
                code: 'PROVIDER_NOT_CONFIGURED',
                message: 'Enterprise MQTT Broker is not configured on the server. Please set MQTT_BROKER_URL.'
            });
        }

        // Save to PostgreSQL with verified caller ID
        const client = await pool.connect();
        try {
            const result = await client.query(
                `INSERT INTO iot_devices (farmer_id, device_name, provider, provider_device_id, credentials, is_active)
                 VALUES ($1, $2, $3, $4, $5, true)
                 RETURNING id, device_name, provider, provider_device_id, is_active, created_at`,
                [callerId, deviceName || 'Agricultural Sensor Hub', provider, providerDeviceId, JSON.stringify(credentials || {})]
            );

            return reply.status(201).send({
                status: 'success',
                message: 'Device successfully bound to farmer account.',
                device: result.rows[0]
            });
        } finally {
            client.release();
        }
    });

    // 3. Send Command (Enforces Strict Ownership & Safety Interlocks)
    fastify.post('/devices/:id/command', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { command } = request.body as { command: string };
        const callerId = request.user?.id;

        if (!callerId) {
            return reply.status(401).send({ status: 'error', message: 'Authentication required: Verified authentication token is missing or invalid.' });
        }

        const client = await pool.connect();
        try {
            const devCheck = await client.query(
                `SELECT id, farmer_id, device_name, provider FROM iot_devices WHERE id = $1`,
                [id]
            );

            if (devCheck.rows.length === 0) {
                return reply.status(404).send({ status: 'error', message: 'IoT device not found.' });
            }

            const device = devCheck.rows[0];

            // Strict Ownership validation derived from verified token
            if (callerId && device.farmer_id && device.farmer_id !== callerId) {
                return reply.status(403).send({ 
                    status: 'error', 
                    message: 'Permission denied: You do not own this agricultural hardware.' 
                });
            }


            // Safety Interlock: Verify device is online before issuing operational commands
            const state = await gateway.getDeviceStatus(id);
            if (state.status === 'offline') {
                return reply.status(400).send({
                    status: 'error',
                    code: 'DEVICE_OFFLINE',
                    message: 'Safety interlock: Hardware device is offline or unverified. Operational commands are blocked until a live heartbeat is received.'
                });
            }

            // Log command into audit queue
            await client.query(
                `INSERT INTO iot_commands_queue (device_id, command, status) VALUES ($1, $2, 'pending')`,
                [id, command]
            );
            
            // Instruct gateway to execute and await telemetry confirmation
            gateway.executeCommand(id, command).catch(err => fastify.log.error(err));
            
            return reply.status(202).send({ 
                status: 'pending_verification', 
                message: 'Command dispatched. Awaiting telemetry confirmation from hardware motor sensor.' 
            });
        } finally {
            client.release();
        }
    });

    // 4. Get Connected Devices (Filtered Strictly by Authenticated Farmer)
    fastify.get('/devices', { preHandler: [authenticate] }, async (request, reply) => {
        const callerId = request.user?.id;

        if (!callerId) {
            return reply.status(401).send({ status: 'error', message: 'Authentication required: Verified authentication token is missing or invalid.' });
        }

        const client = await pool.connect();
        try {
            const res = await client.query(
                `SELECT id, farmer_id, device_name, provider, provider_device_id, is_active, created_at 
                 FROM iot_devices 
                 WHERE farmer_id = $1 
                 ORDER BY created_at DESC`,
                [callerId]
            );
            return { status: 'success', devices: res.rows };
        } finally {
            client.release();
        }
    });
}
