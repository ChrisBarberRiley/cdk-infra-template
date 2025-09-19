import { Stack, StackProps, Duration, RemovalPolicy } from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { BaseProps, name } from "./shared";

export class EventsStack extends Stack {
  public readonly topic: sns.Topic;
  public readonly moderationQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: StackProps & BaseProps) {
    super(scope, id, props);

    const eventsBase =
      (this.node.tryGetContext("eventsBase") as string) ?? "events";

    // DLQ for moderation worker
    const dlq = new sqs.Queue(this, "DLQ", {
      queueName: name(`${eventsBase}-dlq`, props),
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    dlq.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Main moderation queue (1-minute initial delay)
    this.moderationQueue = new sqs.Queue(this, "Queue", {
      queueName: name(`${eventsBase}-queue`, props),
      visibilityTimeout: Duration.seconds(60),
      deliveryDelay: Duration.seconds(60),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    this.moderationQueue.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // SNS topic for domain events
    this.topic = new sns.Topic(this, "Topic", {
      topicName: name(eventsBase, props),
    });

    // SNS → SQS subscription
    this.topic.addSubscription(new subs.SqsSubscription(this.moderationQueue));

    // SSM params for easy discovery
    new ssm.StringParameter(this, "TopicArn", {
      parameterName: `/${props.project}/${props.stage}/events/topic_arn`,
      stringValue: this.topic.topicArn,
    });

    new ssm.StringParameter(this, "ModerationQueueUrl", {
      parameterName: `/${props.project}/${props.stage}/events/moderation_queue_url`,
      stringValue: this.moderationQueue.queueUrl,
    });

    new ssm.StringParameter(this, "ModerationQueueArn", {
      parameterName: `/${props.project}/${props.stage}/events/moderation_queue_arn`,
      stringValue: this.moderationQueue.queueArn,
    });
  }
}
