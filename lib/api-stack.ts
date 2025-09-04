import { Stack, StackProps } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { BaseProps } from "./shared";

interface ApiProps extends StackProps, BaseProps {
  httpFn: lambda.IFunction;
}

export class ApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id, props);

    const routeBase =
      (this.node.tryGetContext("routeBase") as string) ?? "items";

    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      createDefaultStage: true,
    });
    const integ = new integrations.HttpLambdaIntegration("Http", props.httpFn);

    this.httpApi.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: integ,
    });
    this.httpApi.addRoutes({
      path: `/${routeBase}`,
      methods: [apigwv2.HttpMethod.POST],
      integration: integ,
    });

    new ssm.StringParameter(this, "ApiUrlParam", {
      parameterName: `/${props.project}/${props.stage}/api_url`,
      stringValue: this.httpApi.apiEndpoint,
    });
  }
}
