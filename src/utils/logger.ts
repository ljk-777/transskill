import chalk from 'chalk';

export function logSuccess(message: string): void {
  console.log(`${chalk.green('✅')} ${message}`);
}

export function logWarning(message: string): void {
  console.log(`${chalk.yellow('⚠️')}  ${message}`);
}

export function logError(message: string): void {
  console.log(`${chalk.red('❌')} ${message}`);
}

export function logInfo(message: string): void {
  console.log(`${chalk.blue('ℹ️')}  ${message}`);
}

export function logDryRun(message: string): void {
  console.log(`${chalk.cyan('🔍')} ${chalk.dim('[DRY-RUN]')} ${message}`);
}

export function logTitle(title: string): void {
  console.log(`\n${chalk.bold(title)}`);
}
