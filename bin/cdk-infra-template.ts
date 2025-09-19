import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { EventsStack } from "../lib/events-stack";
import { LambdasStack } from "../lib/lambdas-stack";
import { ApiStack } from "../lib/api-stack";

const app = new cdk.App();
const project = (app.node.tryGetContext("project") as string) ?? "sample";
const stage =
  (app.node.tryGetContext("stage") as "dev" | "stg" | "prod") ?? "dev";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const data = new DataStack(app, `${project}-${stage}-data`, {
  env,
  project,
  stage,
});
const events = new EventsStack(app, `${project}-${stage}-events`, {
  env,
  project,
  stage,
});
const lambdas = new LambdasStack(app, `${project}-${stage}-lambdas`, {
  env,
  project,
  stage,
  table: data.table,
  topic: events.topic,
  moderationQueue: events.moderationQueue,
});

const apis = new ApiStack(app, `${project}-${stage}-api`, {
  env,
  project,
  stage,
  httpFn: lambdas.httpFn,
});
