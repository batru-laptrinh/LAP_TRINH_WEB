import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  validateRegistration,
  RegistrationModel,
  RegistrationError,
} from '../js/models/registration-model.js';

const STORAGE_KEY = 'scientific-conference.registrations.v1';

function validRegistration(overrides = {}) {
  return {
    fullName: 'Nguyễn Minh Anh',
    email: 'anh@example.com',
    phone: '0912345678',
    organization: 'Trường Đại học Minh Họa',
    audience: 'student',
    attendance: 'in-person',
    topics: ['digital-transformation'],
    notes: '',
    consent: true,
    ...overrides,
  };
}

function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, String(value)); },
    entries,
  };
}

function expectRegistrationError(action, field) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof RegistrationError);
    assert.ok(error.errors[field], `Expected an error for ${field}`);
    return true;
  });
}

test('email normalization trims whitespace and ignores case', () => {
  assert.equal(normalizeEmail('  Minh.Anh@Example.COM  '), 'minh.anh@example.com');
});

test('valid form is normalized without altering the supplied object', () => {
  const raw = validRegistration({
    fullName: '  Nguyễn Minh Anh  ',
    email: '  ANH@Example.COM ',
    phone: ' 0912345678 ',
    organization: '  Đại học Minh Họa  ',
    notes: '  Cần tài liệu  ',
  });
  const original = structuredClone(raw);
  const { data, errors } = validateRegistration(raw);
  assert.deepEqual(errors, {});
  assert.equal(data.fullName, 'Nguyễn Minh Anh');
  assert.equal(data.email, 'anh@example.com');
  assert.equal(data.phone, '0912345678');
  assert.equal(data.organization, 'Đại học Minh Họa');
  assert.equal(data.notes, 'Cần tài liệu');
  assert.deepEqual(raw, original);
});

test('all required fields have individual errors on an empty form', () => {
  const { errors } = validateRegistration({});
  for (const field of ['fullName', 'email', 'phone', 'organization', 'audience', 'attendance', 'topics', 'consent']) {
    assert.ok(errors[field], `${field} should have an error`);
  }
});

test('name length is checked after trimming, and two characters are accepted', () => {
  assert.ok(validateRegistration(validRegistration({ fullName: ' A ' })).errors.fullName);
  assert.equal(validateRegistration(validRegistration({ fullName: ' An ' })).errors.fullName, undefined);
});

test('email and phone reject malformed values', () => {
  for (const email of ['abc', 'abc@', '@example.com', 'a b@example.com',
    'an@example..com', 'an@example.com.', 'an@.example.com', 'an@-example.com',
    'an@example-.com', '.an@example.com', 'an..nguyen@example.com']) {
    assert.ok(validateRegistration(validRegistration({ email })).errors.email, email);
  }
  for (const phone of ['9123456789', '091234567', '09123456789', '+84912345678', '09a2345678']) {
    assert.ok(validateRegistration(validRegistration({ phone })).errors.phone, phone);
  }
});

test('select, radio and topic values cannot be forged', () => {
  for (const [field, value] of [
    ['audience', 'administrator'],
    ['attendance', 'hybrid'],
    ['topics', []],
    ['topics', ['unknown-topic']],
  ]) {
    assert.ok(validateRegistration(validRegistration({ [field]: value })).errors[field], field);
  }
});

test('every documented audience, attendance mode and topic is accepted', () => {
  for (const audience of ['lecturer', 'researcher', 'business', 'student']) {
    assert.deepEqual(validateRegistration(validRegistration({ audience })).errors, {});
  }
  for (const attendance of ['in-person', 'online']) {
    assert.deepEqual(validateRegistration(validRegistration({ attendance })).errors, {});
  }
  for (const topic of ['digital-transformation', 'green-technology', 'sustainable-education']) {
    assert.deepEqual(validateRegistration(validRegistration({ topics: [topic] })).errors, {});
  }
});

test('notes are optional, accept 300 characters and reject 301', () => {
  assert.equal(validateRegistration(validRegistration({ notes: '' })).errors.notes, undefined);
  assert.equal(validateRegistration(validRegistration({ notes: 'a'.repeat(300) })).errors.notes, undefined);
  assert.ok(validateRegistration(validRegistration({ notes: 'a'.repeat(301) })).errors.notes);
});

test('consent must explicitly be confirmed', () => {
  assert.ok(validateRegistration(validRegistration({ consent: false })).errors.consent);
});

test('duplicate email comparison trims whitespace and ignores case', () => {
  const existing = [validRegistration({ email: ' ANH@EXAMPLE.COM ' })];
  assert.ok(validateRegistration(validRegistration({ email: ' anh@example.com ' }), existing).errors.email);
  assert.equal(validateRegistration(validRegistration({ email: 'other@example.com' }), existing).errors.email, undefined);
});

test('adding records persists them, generates IDs and timestamps, and updates statistics', () => {
  const storage = memoryStorage();
  const model = new RegistrationModel(storage);
  assert.deepEqual(model.getStats(), { total: 0, inPerson: 0, online: 0 });
  const first = model.add(validRegistration());
  const second = model.add(validRegistration({ email: 'second@example.com', attendance: 'online' }));
  assert.ok(first.id);
  assert.ok(second.id);
  assert.notEqual(first.id, second.id);
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  assert.deepEqual(model.getStats(), { total: 2, inPerson: 1, online: 1 });
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 2);
  const reloaded = new RegistrationModel(storage);
  assert.deepEqual(reloaded.registrations, model.registrations);
  assert.deepEqual(reloaded.getStats(), { total: 2, inPerson: 1, online: 1 });
});

test('an invalid submission neither changes records nor writes storage', () => {
  const storage = memoryStorage();
  const model = new RegistrationModel(storage);
  expectRegistrationError(() => model.add(validRegistration({ phone: '123' })), 'phone');
  assert.deepEqual(model.registrations, []);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('a duplicate email is rejected after a page reload', () => {
  const storage = memoryStorage();
  new RegistrationModel(storage).add(validRegistration());
  const model = new RegistrationModel(storage);
  expectRegistrationError(() => model.add(validRegistration({ email: ' ANH@EXAMPLE.COM ' })), 'email');
  assert.equal(model.registrations.length, 1);
});

test('deletion persists and statistics remain correct', () => {
  const storage = memoryStorage();
  const model = new RegistrationModel(storage);
  const first = model.add(validRegistration());
  const second = model.add(validRegistration({ email: 'second@example.com', attendance: 'online' }));
  assert.equal(model.remove(first.id), true);
  assert.deepEqual(model.getStats(), { total: 1, inPerson: 0, online: 1 });
  assert.equal(model.remove('missing-id'), false);
  assert.deepEqual(new RegistrationModel(storage).registrations.map((record) => record.id), [second.id]);
  assert.equal(model.remove(second.id), true);
  assert.deepEqual(model.getStats(), { total: 0, inPerson: 0, online: 0 });
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), []);
});

test('mutating the returned record list cannot remove internal records', () => {
  const model = new RegistrationModel(memoryStorage());
  model.add(validRegistration());
  model.registrations.pop();
  assert.equal(model.registrations.length, 1);
});

test('refresh reads another instance\'s saved registrations', () => {
  const storage = memoryStorage();
  const first = new RegistrationModel(storage);
  const second = new RegistrationModel(storage);
  first.add(validRegistration());
  second.refresh();
  assert.deepEqual(second.registrations, first.registrations);
});

test('failed writes report storage errors and leave memory and persisted data intact', () => {
  const storage = memoryStorage();
  const model = new RegistrationModel(storage);
  const record = model.add(validRegistration());
  const original = storage.getItem(STORAGE_KEY);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  expectRegistrationError(() => model.add(validRegistration({ email: 'second@example.com' })), 'storage');
  assert.equal(model.registrations.length, 1);
  assert.equal(storage.getItem(STORAGE_KEY), original);
  expectRegistrationError(() => model.remove(record.id), 'storage');
  assert.equal(model.registrations.length, 1);
  assert.equal(storage.getItem(STORAGE_KEY), original);
});

test('unreadable storage is reported and cannot silently lose saved data', () => {
  const storage = {
    getItem() { throw new Error('Access denied'); },
    setItem() { assert.fail('must not overwrite unreadable storage'); },
  };
  const model = new RegistrationModel(storage);
  assert.ok(model.storageWarning);
  expectRegistrationError(() => model.add(validRegistration()), 'storage');
});

test('malformed stored JSON is preserved, with writes blocked until repaired', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{broken json' });
  const model = new RegistrationModel(storage);
  assert.ok(model.storageWarning);
  expectRegistrationError(() => model.add(validRegistration()), 'storage');
  expectRegistrationError(() => model.remove('any-id'), 'storage');
  assert.equal(storage.getItem(STORAGE_KEY), '{broken json');
  storage.setItem(STORAGE_KEY, '[]');
  model.refresh();
  assert.equal(model.storageWarning, '');
  model.add(validRegistration());
  assert.equal(model.registrations.length, 1);
});

test('a stale tab preserves registrations saved by another tab and rejects new duplicates', () => {
  const storage = memoryStorage();
  const firstTab = new RegistrationModel(storage);
  const secondTab = new RegistrationModel(storage);
  firstTab.add(validRegistration());
  expectRegistrationError(() => secondTab.add(validRegistration({ email: ' ANH@EXAMPLE.COM ' })), 'email');
  secondTab.add(validRegistration({ email: 'second@example.com', attendance: 'online' }));
  firstTab.refresh();
  assert.deepEqual(firstTab.getStats(), { total: 2, inPerson: 1, online: 1 });
});

test('mutating a returned record and topics cannot corrupt the internal data', () => {
  const model = new RegistrationModel(memoryStorage());
  const added = model.add(validRegistration());
  added.email = 'changed@example.com';
  added.topics.push('unknown-topic');
  const exposed = model.registrations;
  exposed[0].email = 'also-changed@example.com';
  exposed[0].topics.length = 0;
  assert.equal(model.registrations[0].email, 'anh@example.com');
  assert.deepEqual(model.registrations[0].topics, ['digital-transformation']);
});

test('valid JSON with an invalid saved record is preserved instead of overwritten', () => {
  for (const invalid of ['{}', '[null]', '[{"email":"not-a-valid-registration"}]']) {
    const storage = memoryStorage({ [STORAGE_KEY]: invalid });
    const model = new RegistrationModel(storage);
    assert.ok(model.storageWarning);
    expectRegistrationError(() => model.add(validRegistration()), 'storage');
    assert.equal(storage.getItem(STORAGE_KEY), invalid);
  }
});
