import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function migrateUsers() {
  console.log('🔄 Migrating users from JSON to Prisma database...');
  
  try {
    // Read existing users from JSON file
    const usersJsonPath = join(__dirname, 'src/data/users.json');
    const usersData = JSON.parse(readFileSync(usersJsonPath, 'utf-8'));
    
    console.log(`📊 Found ${usersData.length} users in JSON file`);
    
    // Clear existing users in database (optional)
    await prisma.user.deleteMany();
    console.log('🗑️ Cleared existing users from database');
    
    // Migrate each user
    for (const user of usersData) {
      try {
        await prisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            displayName: user.displayName,
            createdAt: new Date(user.createdAt)
          }
        });
        console.log(`✅ Migrated user: ${user.email}`);
      } catch (error) {
        console.error(`❌ Failed to migrate user ${user.email}:`, error);
      }
    }
    
    // Verify migration
    const dbUsers = await prisma.user.findMany();
    console.log(`🎉 Migration complete! ${dbUsers.length} users now in database`);
    
    dbUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.displayName})`);
    });
    
  } catch (error) {
    console.error('🚨 Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateUsers();
