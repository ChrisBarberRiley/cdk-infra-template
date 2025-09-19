import { APIGatewayProxyEventV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const sns = new SNSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME!;
const PK_PREFIX = process.env.PK_PREFIX ?? ""; // optional
const ROUTE_BASE = process.env.ROUTE_BASE ?? "activities";
const TOPIC_ARN = process.env.TOPIC_ARN!;

export const handler = async (event: APIGatewayProxyEventV2) => {
  const { method, path } = event.requestContext.http;

  // health check
  if (method === "GET" && path === "/health") return ok({ status: "ok" });

  if (method === "POST" && path === `/${ROUTE_BASE}`) {
    const body = event.body ? JSON.parse(event.body) : {};
    const id = cryptoId();
    const now = new Date().toISOString();
    const sk = `createdAt#${Date.now()}#${id}`;
    const pk = [PK_PREFIX, "ACTIVITY"].filter(Boolean).join("#");

    const item = {
      pk,
      sk,
      id,
      entity: "activity",
      status: "PENDING",
      ...body,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

    // publish event with the exact keys so the worker can update by pk/sk
    await sns.send(
      new PublishCommand({
        TopicArn: TOPIC_ARN,
        Message: JSON.stringify({
          type: "ActivityCreated",
          pk,
          sk,
          id,
        }),
      })
    );

    return created({ id, status: "PENDING" });
  }

  if (method === "GET" && path === `/${ROUTE_BASE}`) {
    const pk = [PK_PREFIX, "ACTIVITY"].filter(Boolean).join("#");
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false,
        Limit: 20,
      })
    );
    return ok(res.Items ?? []);
  }

  return notFound();
};

const ok = (data: unknown) => resp(200, data);
const created = (data: unknown) => resp(201, data);
const notFound = () => resp(404, { message: "Not found" });
const resp = (statusCode: number, data: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});
const cryptoId = () => Math.random().toString(36).slice(2, 10);
