import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import { BaseProps, name } from "./shared";
import { join } from "path";

interface LambdasProps extends StackProps, BaseProps {
  table: dynamodb.ITable;
  topic: sns.ITopic;
}

export class LambdasStack extends Stack {
  public readonly httpFn: lambda.NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdasProps) {
    super(scope, id, props);

    const pkPrefix = (this.node.tryGetContext("pkPrefix") as string) ?? "";

    this.httpFn = new lambda.NodejsFunction(this, "Http", {
      functionName: name("http", props),
      entry: join(process.cwd(), "lambda", "http.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      bundling: { minify: true },
      environment: {
        TABLE_NAME: props.table.tableName,
        TOPIC_ARN: props.topic.topicArn,
        PK_PREFIX: pkPrefix,
      },
    });

    props.table.grantReadWriteData(this.httpFn);
    props.topic.grantPublish(this.httpFn);
  }
}
