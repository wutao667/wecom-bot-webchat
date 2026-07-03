const path = require('path');
const fs = require('fs');
const config = require('../config');

function migrate(db) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('[migrate] Running database migration...');
  db.exec(schema);
  console.log('[migrate] Migration completed successfully');
}

module.exports = migrate;
