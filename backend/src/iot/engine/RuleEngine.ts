import { IotDeviceState } from '../providers/BaseDeviceProvider';
import { IoTGateway } from '../Gateway';

export interface AutomationRule {
    id: string;
    deviceId: string;
    conditionMetric: 'moisture' | 'voltage' | 'amperage';
    conditionOp: '<' | '>' | '==';
    conditionValue: number;
    actionCommand: 'MOTOR_ON' | 'MOTOR_OFF';
}

/**
 * Executes automated IF/THEN farming rules based on incoming live telemetry
 */
export class RuleEngine {
    private gateway: IoTGateway;
    private rules: AutomationRule[] = [];

    constructor(gateway: IoTGateway) {
        this.gateway = gateway;
    }

    loadRules(rules: AutomationRule[]) {
        this.rules = rules;
    }

    evaluate(deviceId: string, state: IotDeviceState) {
        const deviceRules = this.rules.filter(r => r.deviceId === deviceId);

        for (const rule of deviceRules) {
            let metricValue: number | undefined;

            switch (rule.conditionMetric) {
                case 'moisture': metricValue = state.moisture; break;
                case 'voltage': metricValue = state.voltage; break;
                case 'amperage': metricValue = state.amperage; break;
            }

            if (metricValue === undefined) continue;

            let conditionMet = false;
            switch (rule.conditionOp) {
                case '<': conditionMet = metricValue < rule.conditionValue; break;
                case '>': conditionMet = metricValue > rule.conditionValue; break;
                case '==': conditionMet = metricValue === rule.conditionValue; break;
            }

            if (conditionMet) {
                console.log(`[RuleEngine] ⚡ Rule triggered for ${deviceId}: ${rule.conditionMetric} ${rule.conditionOp} ${rule.conditionValue} -> ${rule.actionCommand}`);
                
                // Dispatch action via the Gateway
                this.gateway.executeCommand(deviceId, rule.actionCommand)
                    .then(() => {
                        console.log(`[RuleEngine] Action ${rule.actionCommand} dispatched successfully.`);
                    })
                    .catch((err: any) => {
                        console.error(`[RuleEngine] Action ${rule.actionCommand} failed:`, err);
                    });
            }
        }
    }
}
