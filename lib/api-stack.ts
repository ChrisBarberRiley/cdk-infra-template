import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
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

    // HTTP API
    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `${props.project}-${props.stage}-api`,
      createDefaultStage: false,
    });

    const stage = new apigwv2.HttpStage(this, "Stage", {
      httpApi: this.httpApi,
      stageName: props.stage,
      autoDeploy: true,
    });

    // Routes
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

    // WAF: per-IP rate limit - requests per 5 minutes
    const webAcl = new wafv2.CfnWebACL(this, "ApiWaf", {
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${props.project}-${props.stage}-api-waf`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "RateLimitPerIP",
          priority: 1,
          statement: {
            rateBasedStatement: { aggregateKeyType: "IP", limit: 1000 },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitPerIP",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedCommon",
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedCommon",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, "ApiWafAssoc", {
      resourceArn: `arn:aws:apigateway:${this.region}::/apis/${this.httpApi.apiId}/stages/${stage.stageName}`,
      webAclArn: webAcl.attrArn,
    });

    // Publish
    new ssm.StringParameter(this, "ApiUrlParam", {
      parameterName: `/${props.project}/${props.stage}/api_url`,
      stringValue: `${this.httpApi.apiEndpoint}/${stage.stageName}`,
    });
  }
}
