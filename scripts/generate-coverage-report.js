#!/usr/bin/env node

/**
 * Coverage Report Generator for Freshdesk MCP
 * 
 * This script generates comprehensive test coverage reports and validates
 * that coverage meets the required thresholds (95%+).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Coverage thresholds
const COVERAGE_THRESHOLDS = {
  statements: 95,
  branches: 95,
  functions: 95,
  lines: 95,
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTitle(title) {
  log(`\n${colors.bold}${'='.repeat(60)}`, 'cyan');
  log(`${colors.bold}  ${title}`, 'cyan');
  log(`${colors.bold}${'='.repeat(60)}`, 'cyan');
}

function logSection(title) {
  log(`\n${colors.bold}${'-'.repeat(40)}`, 'blue');
  log(`${colors.bold}  ${title}`, 'blue');
  log(`${colors.bold}${'-'.repeat(40)}`, 'blue');
}

function runCommand(command, description) {
  log(`\n📋 ${description}...`, 'yellow');
  try {
    const output = execSync(command, { 
      cwd: projectRoot, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    log(`✅ ${description} completed successfully`, 'green');
    return output;
  } catch (error) {
    log(`❌ ${description} failed:`, 'red');
    log(error.message, 'red');
    if (error.stdout) {
      log('STDOUT:', 'yellow');
      log(error.stdout, 'reset');
    }
    if (error.stderr) {
      log('STDERR:', 'yellow');
      log(error.stderr, 'reset');
    }
    throw error;
  }
}

function readCoverageJson() {
  const coveragePath = path.join(projectRoot, 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(coveragePath)) {
    throw new Error('Coverage summary file not found. Run tests with coverage first.');
  }
  
  const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  return coverageData;
}

function formatPercentage(value) {
  const percentage = value.toFixed(2);
  const color = value >= 95 ? 'green' : value >= 90 ? 'yellow' : 'red';
  return `${colors[color]}${percentage}%${colors.reset}`;
}

function displayCoverageResults(coverage) {
  logSection('Coverage Results');
  
  const total = coverage.total;
  
  log(`📊 Overall Coverage Statistics:`, 'bold');
  log(`   Statements: ${formatPercentage(total.statements.pct)} (${total.statements.covered}/${total.statements.total})`);
  log(`   Branches:   ${formatPercentage(total.branches.pct)} (${total.branches.covered}/${total.branches.total})`);
  log(`   Functions:  ${formatPercentage(total.functions.pct)} (${total.functions.covered}/${total.functions.total})`);
  log(`   Lines:      ${formatPercentage(total.lines.pct)} (${total.lines.covered}/${total.lines.total})`);
  
  // Check if thresholds are met
  const results = {
    statements: total.statements.pct >= COVERAGE_THRESHOLDS.statements,
    branches: total.branches.pct >= COVERAGE_THRESHOLDS.branches,
    functions: total.functions.pct >= COVERAGE_THRESHOLDS.functions,
    lines: total.lines.pct >= COVERAGE_THRESHOLDS.lines,
  };
  
  const allPassed = Object.values(results).every(Boolean);
  
  logSection('Threshold Validation');
  
  log(`🎯 Required Thresholds (${COVERAGE_THRESHOLDS.statements}%):`, 'bold');
  Object.entries(results).forEach(([metric, passed]) => {
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : 'FAIL';
    const color = passed ? 'green' : 'red';
    log(`   ${icon} ${metric.padEnd(12)} ${status}`, color);
  });
  
  if (allPassed) {
    log(`\n🎉 All coverage thresholds met! Great job!`, 'green');
  } else {
    log(`\n⚠️  Some coverage thresholds not met. Please add more tests.`, 'red');
  }
  
  return allPassed;
}

function displayFileCoverage(coverage) {
  logSection('File-by-File Coverage');
  
  const files = Object.entries(coverage)
    .filter(([filename]) => filename !== 'total')
    .sort(([, a], [, b]) => a.lines.pct - b.lines.pct); // Sort by line coverage
  
  if (files.length === 0) {
    log('No file coverage data available.', 'yellow');
    return;
  }
  
  log('📁 Files with lowest coverage first:\n');
  
  files.forEach(([filename, fileCoverage]) => {
    const shortName = filename.replace(projectRoot, '').replace(/^\//, '');
    const linesCoverage = fileCoverage.lines.pct;
    const color = linesCoverage >= 95 ? 'green' : linesCoverage >= 90 ? 'yellow' : 'red';
    
    log(`${shortName.padEnd(50)} ${formatPercentage(linesCoverage)}`, color);
  });
  
  // Find files with low coverage
  const lowCoverageFiles = files.filter(([, fileCoverage]) => fileCoverage.lines.pct < 90);
  
  if (lowCoverageFiles.length > 0) {
    log(`\n⚠️  Files needing attention (< 90% coverage):`, 'yellow');
    lowCoverageFiles.forEach(([filename, fileCoverage]) => {
      const shortName = filename.replace(projectRoot, '').replace(/^\//, '');
      log(`   📝 ${shortName} - ${formatPercentage(fileCoverage.lines.pct)}`, 'red');
    });
  }
}

function generateReports() {
  logSection('Generating Reports');
  
  // Generate HTML report
  log('📄 Generating HTML coverage report...', 'blue');
  const htmlReportPath = path.join(projectRoot, 'coverage', 'lcov-report', 'index.html');
  if (fs.existsSync(htmlReportPath)) {
    log(`   HTML report available at: file://${htmlReportPath}`, 'green');
  }
  
  // Generate XML report for CI
  const xmlReportPath = path.join(projectRoot, 'coverage', 'coverage-final.json');
  if (fs.existsSync(xmlReportPath)) {
    log(`   JSON report available at: ${xmlReportPath}`, 'green');
  }
  
  // Generate LCOV report for external tools
  const lcovReportPath = path.join(projectRoot, 'coverage', 'lcov.info');
  if (fs.existsSync(lcovReportPath)) {
    log(`   LCOV report available at: ${lcovReportPath}`, 'green');
  }
}

function generateSummaryBadge(coverage) {
  const total = coverage.total;
  const averageCoverage = Math.round(
    (total.statements.pct + total.branches.pct + total.functions.pct + total.lines.pct) / 4
  );
  
  const badgeColor = averageCoverage >= 95 ? 'brightgreen' : 
                     averageCoverage >= 90 ? 'green' :
                     averageCoverage >= 80 ? 'yellow' : 'red';
  
  const badgeUrl = `https://img.shields.io/badge/coverage-${averageCoverage}%25-${badgeColor}`;
  
  log(`\n🏷️  Coverage Badge URL:`, 'bold');
  log(`   ${badgeUrl}`, 'cyan');
  
  // Generate badge markdown
  const badgeMarkdown = `![Coverage](${badgeUrl})`;
  log(`\n📋 Badge Markdown:`, 'bold');
  log(`   ${badgeMarkdown}`, 'cyan');
}

async function main() {
  try {
    logTitle('Freshdesk MCP - Test Coverage Report Generator');
    
    // Run all tests with coverage
    runCommand('npm run test:coverage', 'Running all tests with coverage');
    
    // Read coverage data
    log('\n📊 Reading coverage data...', 'yellow');
    const coverage = readCoverageJson();
    
    // Display results
    displayCoverageResults(coverage);
    displayFileCoverage(coverage);
    generateReports();
    generateSummaryBadge(coverage);
    
    // Final summary
    logTitle('Coverage Report Generation Complete');
    
    const total = coverage.total;
    const allThresholdsMet = [
      total.statements.pct,
      total.branches.pct, 
      total.functions.pct,
      total.lines.pct
    ].every(pct => pct >= 95);
    
    if (allThresholdsMet) {
      log('🎉 Excellent! All coverage thresholds (95%+) are met.', 'green');
      log('📝 Your code is well-tested and ready for production.', 'green');
      process.exit(0);
    } else {
      log('⚠️  Coverage thresholds not met. Please add more tests.', 'yellow');
      log('💡 Focus on the files and metrics shown above.', 'yellow');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n❌ Coverage report generation failed:`, 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}