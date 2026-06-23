import { EventEmitter } from "events";

const emitter = new EventEmitter()
emitter.setMaxListeners(50)

export const POST_CREATED = "POST_CREATED"

export const pubsub = {
    publish(event: string, payload: Record<string, unknown>) {
        emitter.emit(event, payload)
    },

    asyncIterator(event: string) {
        return createAsyncIterator(event)
    },
};

async function* createAsyncIterator(event: string) {
    const pullQueue: ((value: unknown) => void)[] = []
    const pushQueue: unknown[] = []
    let done = false

    const pushValue = (value: unknown) => {
        if (pullQueue.length > 0) {
            pullQueue.shift()!(value)
        } else {
            pushQueue.push(value)
        }
    };

    emitter.on(event, pushValue)

    try {
        while (!done) {
            if (pushQueue.length > 0) {
                yield pushQueue.shift()
            } else {
                yield await new Promise((resolve) => pullQueue.push(resolve))
            }
        }
    } finally {
        done = true
        emitter.off(event, pushValue)
    }
}
