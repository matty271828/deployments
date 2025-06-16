# Get domain mappings from R2
data "external" "domain_mappings" {
  program = ["bash", "-c", <<-EOT
    response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${var.cloudflare_account_id}/r2/buckets/domain-mappings/objects/mappings.json" \
      -H "Authorization: Bearer ${var.cloudflare_api_token}" \
      -H "Content-Type: application/json")
    
    # Check if the response is valid JSON
    if ! echo "$response" | jq empty 2>/dev/null; then
      echo "Error: Invalid JSON response from R2 API" >&2
      echo "$response" >&2
      exit 1
    fi

    # Check if the object exists
    if echo "$response" | jq -e '.errors[0].code == 10007' > /dev/null; then
      # Object doesn't exist, return empty array
      echo '{"result": "[]"}'
      exit 0
    fi

    # Check for other errors
    if echo "$response" | jq -e '.errors' > /dev/null; then
      echo "Error: Failed to get domain mappings" >&2
      echo "$response" | jq -r '.errors[0].message' >&2
      exit 1
    fi

    # Return the object data
    echo "$response" | jq -r '{result: .result.data}'
  EOT
  ]
}

locals {
  # Parse the domains JSON from R2
  domains = jsondecode(data.external.domain_mappings.result.result)
  
  # Create a map of domains for easier iteration
  domain_map = {
    for domain in local.domains : domain.domain => domain
  }

  # Create a map of frontend repos
  frontend_repos = {
    for domain in local.domains : domain.domain => {
      repo_name = split("/", domain.frontend_repo)[length(split("/", domain.frontend_repo)) - 1]
    }
  }
}