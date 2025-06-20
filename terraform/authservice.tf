# Create the shared auth service worker (intial no-op to ensure worker exists)
resource "cloudflare_workers_script" "auth_service" {
  account_id       = var.cloudflare_account_id
  script_name      = "auth-service"
  # Use addEventListener pattern for a no-op deployment. This is because there is a 
  # bug in the cloudflare terraform provider. We will have to reupload an ES module worker 
  # using the API after our terraform run has completed.
  content          = "addEventListener('fetch', event => { event.respondWith(new Response('OK')) })"
}

# Create worker routes for each domain to direct /auth/* traffic to the worker
#
# NOTE: this is needed so that traffic coming via multiple DNS records can find 
# its way to the same worker and is not needed for all workers.
resource "cloudflare_workers_route" "auth_route" {
  for_each = local.frontend_repos

  zone_id     = cloudflare_zone.domain[each.key].id
  pattern     = "${each.key}/auth/*"
  script      = "auth-service"

  depends_on = [cloudflare_workers_script.auth_service]
}

# Create the shared auth service database
resource "cloudflare_d1_database" "AUTH_DB" {
  account_id = var.cloudflare_account_id
  name       = "AUTH_DB"
  read_replication = {
    mode = "disabled"
  }
}

# Output the AUTH_DB database ID for use in wrangler.toml
output "auth_db_id" {
  description = "The ID of the AUTH_DB D1 database"
  value       = cloudflare_d1_database.AUTH_DB.id
  sensitive   = true
}