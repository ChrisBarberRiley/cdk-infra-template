import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { EventsStack } from "../lib/events-stack";

const app = new cdk.App();
const project = (app.node.tryGetContext("project") as string) ?? "sample";
const stage =
  (app.node.tryGetContext("stage") as "dev" | "stg" | "prod") ?? "dev";
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new DataStack(app, `${project}-${stage}-data`, { env, project, stage });
new EventsStack(app, `${project}-${stage}-events`, { env, project, stage });
