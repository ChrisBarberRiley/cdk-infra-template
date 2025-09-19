import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { BaseProps, name } from "./shared";
import { join } from "path";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

interface LambdasProps extends StackProps, BaseProps {
  table: dynamodb.ITable;
  topic: sns.ITopic;
  moderationQueue: sqs.IQueue;
}

export class LambdasStack extends Stack {
  public readonly httpFn: lambda.NodejsFunction;
  public readonly moderationFn: lambda.NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdasProps) {
    super(scope, id, props);

    const pkPrefix = (this.node.tryGetContext("pkPrefix") as string) ?? "";
    const routeBase = (this.node.tryGetContext("routeBase") as string) ?? "";

    this.httpFn = new lambda.NodejsFunction(this, "Http", {
      functionName: name("http", props),
      entry: join(process.cwd(), "lambda", "http.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      bundling: { minify: true },
      environment: {
        TABLE_NAME: props.table.tableName,
        TOPIC_ARN: props.topic.topicArn,
        PK_PREFIX: (this.node.tryGetContext("pkPrefix") as string) ?? "",
        ROUTE_BASE: routeBase,
      },
      reservedConcurrentExecutions: 20,
    });

    props.table.grantReadWriteData(this.httpFn);
    props.topic.grantPublish(this.httpFn);

    this.moderationFn = new lambda.NodejsFunction(this, "Moderation", {
      functionName: name("moderation", props),
      entry: join(process.cwd(), "lambda", "moderation.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      bundling: { minify: true },
      environment: {
        TABLE_NAME: props.table.tableName,
      },
      reservedConcurrentExecutions: 5,
    });

    this.moderationFn.addEventSource(
      new lambdaEventSources.SqsEventSource(props.moderationQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      })
    );

    props.table.grantReadWriteData(this.moderationFn);
    props.moderationQueue.grantConsumeMessages(this.moderationFn);
  }
}
