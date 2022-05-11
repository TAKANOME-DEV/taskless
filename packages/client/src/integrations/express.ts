import {
  JobHandler,
  QueueMethods,
  QueueOptions,
  isTasklessBody,
  DefaultJobOptions,
} from "../types.js";
import * as express from "express";
import { Queue } from "../client/Queue.js";

/**
 * An Express compatible API Handler, with Taskless Queue support
 * @template T Used for typing the {@link QueueMethods}
 */
export interface TasklessExpressRouter<T> extends QueueMethods<T> {
  /** The Express router object which should be mounted at Application root via `app.use()` */
  router: express.Router;
}

/**
 * Express Queue Options take all of the optional {@link QueueOptions}
 */
export type ExpressQueueOptions = QueueOptions;

/**
 * Creates an Express Router object augmented with Taskess Queue methods
 * @template T Describes the payload and is passed through to {@link JobHandler}
 * @param name A friendly Queue name for debugging and querying on Taskless.io
 * @param route The URL path to reach this route
 * @param handler A {@link JobHandler} that supports a payload of type `T`
 * @param queueOptions The {@link QueueOptions} for this queue
 * @param defaultJobOptions A set of {@link JobOptions} to apply as defaults for every new job in the Queue
 * @returns {TasklessNextApiHandler}
 */
export function createQueue<T = undefined>(
  name: string,
  route: string,
  handler: JobHandler<T>,
  queueOptions: ExpressQueueOptions,
  defaultJobOptions?: DefaultJobOptions
): TasklessExpressRouter<T> {
  const t = new Queue({
    name,
    route,
    handler,
    queueOptions: queueOptions ?? {},
    jobOptions: defaultJobOptions ?? {},
  });

  const router = express.Router();

  const handle: express.RequestHandler = (request, response) => {
    t.receive({
      getBody: () => {
        // https://expressjs.com/en/4x/api.html#express.json
        if (isTasklessBody(request.body)) {
          return request.body;
        }
        throw new Error("request.body does not match a Taskless payload");
      },
      getHeaders: () => request.headers,
      send: (json) => {
        response.status(200).json(json);
      },
      sendError: (statusCode, headers, json) => {
        response.status(statusCode);
        Object.getOwnPropertyNames(headers).forEach((name) => {
          response.setHeader(name, headers[name] ?? "");
        });
        response.json(json);
      },
    });
  };

  router.post(route, [express.json(), handle]);

  // return API
  const queueApi: TasklessExpressRouter<T> = {
    enqueue: (name, payload, options) => t.enqueue(name, payload, options),
    update: (name, payload, options) => t.update(name, payload, options),
    delete: (name) => t.delete(name),
    get: (name) => t.get(name),
    router: router,
  };

  return queueApi;
}