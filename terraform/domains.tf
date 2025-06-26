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

    # Check for errors
    if echo "$response" | jq -e '.errors' > /dev/null; then
      echo "Error: Failed to get domain mappings" >&2
      echo "$response" | jq -r '.errors[0].message' >&2
      exit 1
    fi

    # Return the array as a stringified JSON
    echo "$response" | jq -r '{result: tostring}'
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

# Create Cloudflare zone for each domain
resource "cloudflare_zone" "domain" {
  for_each = local.frontend_repos

  name = each.key
  account = {
    id = var.cloudflare_account_id
  }
  type       = "full"
}

# Create DNS records for each domain
resource "cloudflare_dns_record" "pages_cname" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "@"  # Use @ to represent the root domain
  content = "${each.value.repo_name}.pages.dev"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  name       = each.value.repo_name
  production_branch = "main"
  
  build_config = {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source = {
    type = "github"
    config = {
      owner = "matty271828"
      repo_name = each.value.repo_name
      production_branch = "main"
    }
  }

  deployment_configs = {
    production = {
      d1_databases = {
        D1_BINDING = {
          id = cloudflare_d1_database.domain_db[each.key].id
        }
      }
    }
  }

  depends_on = [cloudflare_d1_database.domain_db]
}

# Create Email Routing Rules for each domain
resource "cloudflare_email_routing_rule" "domain_email_routing_rule" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  
  actions = [{
    type = "forward"
    value = [var.support_email]  # Forward to the support email provided to deploy job
  }]
  
  matchers = [{
    type = "literal"
    field = "to"
    value = "support@${each.key}"  # Match emails sent to support@domain.com
  }]
  
  enabled = true
  name = "Forward support emails to ${var.support_email} for ${each.key}"
  priority = 0
}