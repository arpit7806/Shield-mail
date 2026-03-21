{
  "name": "My workflow",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "/phishing-alert",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [
        192,
        0
      ],
      "id": "dbb9f51b-aa35-4c44-b0a3-4e61bf2cb348",
      "name": "Webhook",
      "webhookId": "558f4daf-eec4-4e8a-a4fb-10dab5fb2aa4"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://www.fast2sms.com/dev/bulkV2",
        "sendHeaders": true,
        "specifyHeaders": "json",
        "jsonHeaders": "Authorization: YOUR_API_KEY\nContent-Type: application/json",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"route\": \"q\",\n  \"message\": \"🚨 Phishing Alert! Risk Score: {{$json.riskScore}}\",\n  \"language\": \"english\",\n  \"numbers\": \"9711147334\"\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        624,
        -96
      ],
      "id": "7d7d15e7-6ccb-4ed2-847e-44f0df1e06b6",
      "name": "HTTP Request"
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 3
          },
          "conditions": [
            {
              "id": "a46cb43f-df4d-4fc4-b839-bd452d9da285",
              "leftValue": "={{$json[\"body\"][\"riskScore\"]}}",
              "rightValue": 70,
              "operator": {
                "type": "number",
                "operation": "gt"
              }
            }
          ],
          "combinator": "and"
        },
        "looseTypeValidation": true,
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        400,
        0
      ],
      "id": "87030c69-5a37-490a-8fe6-c92132b144fe",
      "name": "If"
    }
  ],
  "pinData": {},
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "If",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If": {
      "main": [
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1",
    "binaryMode": "separate"
  },
  "versionId": "8f23853a-b1b7-4e01-bc7b-2a6cbe68a0c4",
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "f069ee81d241afeaf64c802de59eee32586ac8cb425df06d70720f23268643ca"
  },
  "id": "vPvXnNcGjrkIFZi2",
  "tags": []
}
