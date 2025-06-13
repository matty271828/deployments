# Read domains from file
data "local_file" "domains" {
  filename = "${path.module}/../domains.json"
}

locals {  
  # Create a map of frontend repos
  frontend_repos = { for domain in local.domains : domain.domain => domain.frontend_repo }

  # Parse the domains JSON from GitHub Actions output
  domains = jsondecode(var.domains_json)
  
  # Create a map of domains for easier iteration
  domain_map = {
    for domain in local.domains : domain.domain => domain
  }
}

# Output the parsed domains for reference
output "parsed_domains" {
  value = local.domains
  description = "List of parsed domains from the input JSON"
}