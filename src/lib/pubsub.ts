import { EventEmitter } from "events";
import { PubSub } from "graphql-subscriptions";

const ee = new EventEmitter();
ee.setMaxListeners(5000);

export const POST_CREATED = "POST_CREATED";

const pubsubEngine = new PubSub({ eventEmitter: ee });

export const pubsub = {
    publish(event: string, payload: any) {
        return pubsubEngine.publish(event, payload);
    },
    asyncIterator(event: string) {
        return pubsubEngine.asyncIterableIterator(event);
    }
};
