import sqlite3 from 'sqlite3';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('webapp-devops-db');
const raw = new (sqlite3.verbose().Database)(process.env.DB_PATH || './data.sqlite');

function traced(method) {
  return function (sql, ...args) {
    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;

    const span = tracer.startSpan(`sqlite ${method}`, {
      attributes: {
        'db.system': 'sqlite',
        'db.operation': method,
        'db.statement': String(sql).slice(0, 200),
      },
    });

    return raw[method](sql, ...args, function (err, ...rest) {
      if (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      }
      span.end();
      // Se conserva "this" porque db.run expone this.lastID y this.changes
      if (callback) return callback.call(this, err, ...rest);
    });
  };
}

export const db = {
  run: traced('run'),
  get: traced('get'),
  all: traced('all'),
  exec: traced('exec'),
  serialize: (fn) => raw.serialize(fn),
  close: (cb) => raw.close(cb),
};