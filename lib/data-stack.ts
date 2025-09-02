import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { BaseProps, name } from "./shared";

export class DataStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps & BaseProps) {
    super(scope, id, props);

    const baseName = (this.node.tryGetContext("baseName") as string) ?? "data";

    const table = new dynamodb.Table(this, "Table", {
      tableName: name(baseName, props),
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "TableNameParam", {
      parameterName: `/${props.project}/${props.stage}/table_name`,
      stringValue: table.tableName,
    });
  }
}
