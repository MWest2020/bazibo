# Release automation (fastlane). Runs in GitHub Actions (.github/workflows/ci.yml) or on any
# machine with Ruby: `bundle install`, then `bundle exec fastlane android build` (docs/release.md).
source "https://rubygems.org"

# Pinned exactly: there is no Gemfile.lock yet (no Ruby on the agent host). Bump on purpose,
# after `bundle exec fastlane lanes` passes in CI.
gem "fastlane", "2.241.2"
