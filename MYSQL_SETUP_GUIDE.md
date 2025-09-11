# MySQL Database Setup Guide

This guide will help you set up MySQL database for the HealthGrid AI Triage system.

## Prerequisites

1. **MySQL Server**: Install MySQL 8.0 or higher
2. **Node.js**: Version 18.0.0 or higher
3. **npm**: Version 9.0.0 or higher

## Installation Steps

### 1. Install MySQL Server

#### On macOS (using Homebrew):
```bash
brew install mysql
brew services start mysql
```

#### On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

#### On Windows:
- Download MySQL installer from [MySQL official website](https://dev.mysql.com/downloads/installer/)
- Run the installer and follow the setup wizard
- Start MySQL service from Services panel

### 2. Secure MySQL Installation

```bash
sudo mysql_secure_installation
```

Follow the prompts to:
- Set root password
- Remove anonymous users
- Disable root login remotely
- Remove test database
- Reload privilege tables

### 3. Create Database User (Optional but Recommended)

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create a dedicated user for the application
CREATE USER 'healthgrid'@'localhost' IDENTIFIED BY 'your_secure_password';

-- Grant necessary privileges
GRANT CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, SELECT, REFERENCES, RELOAD on *.* TO 'healthgrid'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

### 4. Configure Environment Variables

Update your `.env` file with your MySQL connection details:

```env
# Database Configuration
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=healthgrid_triage
DB_USERNAME=root
DB_PASSWORD=your_mysql_password

# Or if you created a dedicated user:
# DB_USERNAME=healthgrid
# DB_PASSWORD=your_secure_password
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Database Setup

```bash
npm run setup:db
```

This script will:
- Create the `healthgrid_triage` database
- Create all required tables
- Set up indexes for optimal performance
- Insert sample test data

### 7. Verify Setup

Check if the database was created successfully:

```bash
mysql -u root -p -e "USE healthgrid_triage; SHOW TABLES;"
```

You should see the following tables:
- `sessions`
- `conversation_history`
- `health_records`
- `prescriptions`
- `appointments`
- `insurance_records`
- `hmo_records`
- `diagnostic_lab_records`
- `telemedicine_sessions`
- `system_logs`

## Database Schema Overview

### Core Tables

1. **sessions**: Manages user conversation sessions
2. **conversation_history**: Stores chat messages and interactions
3. **health_records**: Patient health information and assessments
4. **prescriptions**: Digital prescription management
5. **appointments**: Medical appointment scheduling

### Healthcare Integration Tables

6. **insurance_records**: Insurance provider information
7. **hmo_records**: Health Maintenance Organization data
8. **diagnostic_lab_records**: Laboratory test management
9. **telemedicine_sessions**: Virtual consultation tracking
10. **system_logs**: Application event logging

## Troubleshooting

### Common Issues

#### 1. Connection Refused Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions:**
- Check if MySQL service is running: `brew services list | grep mysql` (macOS)
- Start MySQL service: `brew services start mysql` (macOS)
- Verify MySQL is listening on port 3306: `netstat -an | grep 3306`

#### 2. Access Denied Error
```
Error: Access denied for user 'root'@'localhost'
```

**Solutions:**
- Verify your MySQL password in `.env` file
- Reset MySQL root password if forgotten
- Check user privileges: `SHOW GRANTS FOR 'root'@'localhost';`

#### 3. Database Already Exists
```
Error: Can't create database 'healthgrid_triage'; database exists
```

**Solutions:**
- This is usually not an error - the script handles existing databases
- To start fresh, drop the database: `DROP DATABASE healthgrid_triage;`
- Then run the setup script again

#### 4. Table Creation Errors
```
Error: Table 'sessions' already exists
```

**Solutions:**
- The script uses `CREATE TABLE IF NOT EXISTS` - this is normal
- To recreate tables, drop them first or drop the entire database

### Performance Optimization

#### 1. MySQL Configuration

Add these settings to your MySQL configuration file (`my.cnf` or `my.ini`):

```ini
[mysqld]
# Increase buffer pool size for better performance
innodb_buffer_pool_size = 256M

# Optimize for healthcare data
max_connections = 200
query_cache_size = 64M
query_cache_type = 1

# Enable slow query log for debugging
slow_query_log = 1
long_query_time = 2
```

#### 2. Index Optimization

The setup script creates optimized indexes for:
- Phone number lookups
- Date-based queries
- Status filtering
- Session management

#### 3. Regular Maintenance

```sql
-- Analyze tables monthly
ANALYZE TABLE sessions, conversation_history, health_records;

-- Optimize tables quarterly
OPTIMIZE TABLE sessions, conversation_history, health_records;

-- Clean old logs (older than 90 days)
DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

## Backup and Recovery

### Create Backup

```bash
# Full database backup
mysqldump -u root -p healthgrid_triage > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup specific tables
mysqldump -u root -p healthgrid_triage sessions conversation_history health_records > healthcare_data_backup.sql
```

### Restore Backup

```bash
# Restore full database
mysql -u root -p healthgrid_triage < backup_20240115_143022.sql

# Restore specific tables
mysql -u root -p healthgrid_triage < healthcare_data_backup.sql
```

### Automated Backups

Create a cron job for daily backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/bin/mysqldump -u root -pYOUR_PASSWORD healthgrid_triage > /path/to/backups/healthgrid_$(date +\%Y\%m\%d).sql
```

## Security Best Practices

1. **Use Strong Passwords**: Set complex passwords for database users
2. **Limit User Privileges**: Grant only necessary permissions
3. **Enable SSL**: Configure MySQL to use SSL connections
4. **Regular Updates**: Keep MySQL server updated
5. **Monitor Access**: Review MySQL logs regularly
6. **Backup Encryption**: Encrypt backup files
7. **Network Security**: Use firewall rules to restrict database access

## Next Steps

After setting up MySQL:

1. Configure Gupshup WhatsApp API (see `GUPSHUP_SETUP_GUIDE.md`)
2. Test the application: `npm run dev`
3. Set up monitoring and logging
4. Configure backup automation
5. Plan for production deployment

## Support

If you encounter issues:

1. Check the application logs
2. Review MySQL error logs: `/var/log/mysql/error.log`
3. Verify network connectivity
4. Test database connection manually
5. Consult MySQL documentation

---

**Note**: This setup is for development and testing. For production deployment, consider additional security measures, performance tuning, and high availability configurations.