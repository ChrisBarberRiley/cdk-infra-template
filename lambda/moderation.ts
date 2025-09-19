import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME!;

/**
 * Consumes SNS→SQS messages for ActivityCreated and updates status.
 * Expects SNS envelope in SQS body; Message contains JSON: { type, pk, sk, id }.
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      // SNS -> SQS envelope: the actual message is in 'Message'
      const envelope = JSON.parse(record.body);
      const msg =
        typeof envelope.Message === "string"
          ? JSON.parse(envelope.Message)
          : envelope;

      if (msg.type !== "ActivityCreated") {
        continue; // ignore other messages
      }

      // TODO: run real checks here (moderation, enrichment, etc.)
      const approve = true;
      const newStatus = approve ? "APPROVED" : "REJECTED";
      const now = new Date().toISOString();

      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: msg.pk, sk: msg.sk },
          // idempotent: only update if still PENDING (or missing)
          ConditionExpression: "attribute_not_exists(#st) OR #st = :pending",
          UpdateExpression: "SET #st = :new, updatedAt = :now",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: {
            ":pending": "PENDING",
            ":new": newStatus,
            ":now": now,
          },
        })
      );
    } catch (err) {
      console.error("Moderation failed for message", record.messageId, err);
      // re-queue just this record
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};
