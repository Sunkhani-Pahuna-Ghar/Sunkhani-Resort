#!/bin/bash
# Run from the backend folder (sunkhani-resort-3) after unzipping the update over it.
set -e

echo "1/4 Removing old files that no longer fit..."
git rm -q --ignore-unmatch \
  src/database/seeder/seed.command.ts \
  src/modules/auth/dto/reset-pswd.dto.ts \
  src/modules/auth/dto/verify-temp-pswd.dto.ts

echo "2/4 Installing packages..."
npm install helmet @nestjs/throttler
npm install -D supertest @types/supertest

echo "3/4 Updating package.json scripts..."
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
delete p.scripts["seed:user"];
p.scripts["make-admin"] = "ts-node src/database/seeder/make-admin.ts";
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
'

echo "4/4 Building and testing..."
npm run build
npx jest

echo ""
echo "Done. Add these to your .env if missing (see .env.example):"
echo "  CORS_ORIGINS, FRONTEND_URL, OWNER_EMAIL"
