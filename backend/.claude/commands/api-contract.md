# /api-contract

Generate a JSON Schema contract from a FastAPI endpoint.

## Usage

/api-contract <endpoint-name>

## Output

A JSON Schema contract describing the request and response shapes for the given endpoint.
Inspect the router and Pydantic models to infer the contract. Do not add commentary. This should give the configuration
of the endpoint as it would be used by a client.

## Example

/api-contract consent

{
  "contract": "consent",
  "endpoint": "PATCH /api/v1/users/me/consent",
  "request": { ... },
  "response": { ... }
}