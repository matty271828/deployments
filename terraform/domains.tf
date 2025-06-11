# Read existing domains from file
data "local_file" "domains" {
  filename = "${path.module}/domains.txt"
  # Create empty file if it doesn't exist
  count = fileexists("${path.module}/domains.txt") ? 1 : 0
}

locals {
  # Get existing domains from file, or empty list if file doesn't exist
  existing_domains = try(split("\n", data.local_file.domains[0].content), [])
  
  # Add new domain if it's not already in the list
  domains = contains(local.existing_domains, var.domain) ? local.existing_domains : concat(local.existing_domains, [var.domain])
}

# Write updated domains to file
resource "local_file" "domains" {
  filename = "${path.module}/domains.txt"
  content  = join("\n", local.domains)
}

# Output the list of domains for future reference
output "domains" {
  value = local.domains
}

# Additional outputs for better visibility in GitHub Actions
output "current_domain" {
  value = var.domain
  description = "The domain being added in this run"
}

output "existing_domains" {
  value = local.existing_domains
  description = "List of domains that were already in state"
}

output "all_domains" {
  value = local.domains
  description = "Complete list of all domains after this run"
} 