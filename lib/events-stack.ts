import { Stack, StackProps, Duration, RemovalPolicy } from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { BaseProps, name } from "./shared";

export class EventsStack extends Stack {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: StackProps & BaseProps) {
    super(scope, id, props);

    const eventsBase =
      (this.node.tryGetContext("eventsBase") as string) ?? "events";

    const dlq = new sqs.Queue(this, "DLQ", {
      queueName: name(`${eventsBase}-dlq`, props),
      retentionPeriod: Duration.days(14),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const queue = new sqs.Queue(this, "Queue", {
      queueName: name(`${eventsBase}-queue`, props),
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.topic = new sns.Topic(this, "Topic", {
      topicName: name(eventsBase, props),
    });

    this.topic.addSubscription(new subs.SqsSubscription(queue));

    new ssm.StringParameter(this, "TopicArn", {
      parameterName: `/${props.project}/${props.stage}/events/topic_arn`,
      stringValue: this.topic.topicArn,
    });
    new ssm.StringParameter(this, "QueueUrl", {
      parameterName: `/${props.project}/${props.stage}/events/queue_url`,
      stringValue: queue.queueUrl,
    });
  }
}
