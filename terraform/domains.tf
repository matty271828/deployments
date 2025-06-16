# Get domain mappings from R2
data "external" "domain_mappings" {
  program = ["bash", "-c", <<-EOT
    response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${var.cloudflare_account_id}/r2/buckets/domain-mappings/objects/mappings.json" \
      -H "Authorization: Bearer ${var.cloudflare_api_token}" \
      -H "Content-Type: application/json")
    
    if echo "$response" | jq -e '.success == true' > /dev/null; then
      echo "$response" | jq -r '.result.data'
    else
      echo "Error: Failed to get domain mappings"
      echo "$response" | jq -r '.errors[0].message' >&2
      exit 1
    fi
  EOT
  ]
}

locals {
  # Parse the domains JSON from R2
  domains = jsondecode(data.external.domain_mappings.result)
  
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