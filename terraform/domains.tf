# Read domains from file
data "local_file" "domains" {
  filename = "${path.module}/../domains.txt"
}

locals {
  # Split by newline, trim whitespace, and filter out empty strings and comments
  raw_domains = [for domain in split("\n", data.local_file.domains.content) : trimspace(domain) if trimspace(domain) != "" && !startswith(trimspace(domain), "#")]
}

# Output the list of domains for future reference
output "domains" {
  value = local.raw_domains
}

output "current_domain" {
  value = var.domain
  description = "The domain being added in this run"
}