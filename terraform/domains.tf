# Read domains from file
data "local_file" "domains" {
  filename = "${path.module}/../domains.txt"
}

locals {
  # Split by newline, trim whitespace, and filter out empty strings
  domains = [for domain in split("\n", data.local_file.domains.content) : trimspace(domain) if trimspace(domain) != ""]
}

# Output the list of domains for future reference
output "domains" {
  value = local.domains
}

output "current_domain" {
  value = var.domain
  description = "The domain being added in this run"
}