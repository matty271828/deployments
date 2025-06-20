# Create backend worker for each domain
resource "cloudflare_workers_script" "domain_worker" {
  for_each = local.frontend_repos

  account_id       = var.cloudflare_account_id
  script_name      = "${each.value.repo_name}-worker"

  # Use addEventListener pattern for a no-op deployment. This is because there is a 
  # bug in the cloudflare terraform provider. We will have to reupload an ES module worker 
  # using the API after our terraform run has completed.
  content          = "addEventListener('fetch', event => { event.respondWith(new Response('OK')) })"
}

# Create worker routes for each domain to direct /health traffic to the domain worker
#
# This allows public access to the health endpoint for monitoring purposes
resource "cloudflare_workers_route" "domain_health_route" {
  for_each = local.frontend_repos

  zone_id     = cloudflare_zone.domain[each.key].id
  pattern     = "${each.key}/backend/health"
  script      = cloudflare_workers_script.domain_worker[each.key].script_name

  depends_on = [cloudflare_workers_script.domain_worker]
}

# Output domain worker names for worker-to-worker bindings
output "domain_worker_names" {
  description = "The names of the domain workers for worker-to-worker bindings"
  value = {
    for key, worker in cloudflare_workers_script.domain_worker : key => worker.script_name
  }
  sensitive   = true
}

# Create D1 databases for each domain
resource "cloudflare_d1_database" "domain_db" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  name       = "${each.value.repo_name}-db"
  read_replication = {
    mode = "disabled"
  }
}