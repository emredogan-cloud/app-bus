import { Global, Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway.js';
import { MqttBridge } from './mqtt.bridge.js';
import { SubscriptionRegistry } from './subscription.registry.js';

@Global()
@Module({
  providers: [LiveGateway, MqttBridge, SubscriptionRegistry],
  exports: [LiveGateway, MqttBridge],
})
export class LiveModule {}
