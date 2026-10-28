// MODEL: kiểm tra và lưu dữ liệu, không truy cập các phần tử giao diện.
export const STORAGE_KEY = 'scientific-conference.registrations.v1';

export const AUDIENCES = Object.freeze({
  lecturer: 'Giảng viên',
  researcher: 'Nhà nghiên cứu',
  business: 'Doanh nghiệp',
  student: 'Sinh viên',
});
export const ATTENDANCE = Object.freeze({
  'in-person': 'Trực tiếp',
  online: 'Trực tuyến',
});
export const TOPICS = Object.freeze({
  'digital-transformation': 'Chuyển đổi số',
  'green-technology': 'Công nghệ xanh',
  'sustainable-education': 'Giáo dục bền vững',
});

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const hasKey = (object, key) => Object.hasOwn(object, key);
export const normalizeEmail = (value) => clean(value).toLowerCase();
// Email thông dụng: phần tên và tên miền không có dấu chấm rỗng/ở hai đầu.
const EMAIL_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function validateRegistration(raw = {}, registrations = []) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const data = {
    fullName: clean(raw.fullName),
    email: normalizeEmail(raw.email),
    phone: clean(raw.phone),
    organization: clean(raw.organization),
    audience: clean(raw.audience),
    attendance: clean(raw.attendance),
    topics: Array.isArray(raw.topics) ? [...new Set(raw.topics)] : [],
    notes: clean(raw.notes),
    consent: raw.consent === true,
  };
  const errors = {};
  if ([...data.fullName].length < 2) errors.fullName = 'Vui lòng nhập họ tên có ít nhất 2 ký tự.';
  if (!EMAIL_PATTERN.test(data.email)) {
    errors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
  } else if (registrations.some((record) => normalizeEmail(record.email) === data.email)) {
    errors.email = 'Email này đã đăng ký tham dự. Vui lòng dùng email khác.';
  }
  if (!/^0\d{9}$/.test(data.phone)) errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.';
  if (!data.organization) errors.organization = 'Vui lòng nhập đơn vị công tác hoặc trường học.';
  if (!hasKey(AUDIENCES, data.audience)) errors.audience = 'Vui lòng chọn đối tượng tham dự.';
  if (!hasKey(ATTENDANCE, data.attendance)) errors.attendance = 'Vui lòng chọn hình thức tham dự.';
  if (!data.topics.length || data.topics.some((topic) => !hasKey(TOPICS, topic))) {
    errors.topics = 'Vui lòng chọn ít nhất một chủ đề trong danh sách.';
  }
  if ([...data.notes].length > 300) errors.notes = 'Ghi chú không được vượt quá 300 ký tự.';
  if (!data.consent) errors.consent = 'Bạn cần đồng ý sử dụng thông tin đăng ký.';
  return { data, errors };
}

export class RegistrationError extends Error {
  constructor(errors) {
    super(Object.values(errors)[0] || 'Không thể xử lý đăng ký.');
    this.name = 'RegistrationError';
    this.errors = errors;
  }
}

export class RegistrationModel {
  #storage;
  #records = [];
  storageWarning = '';

  constructor(storage) {
    try {
      this.#storage = arguments.length ? storage : globalThis.localStorage;
    } catch {
      this.#storage = null;
    }
    this.refresh();
  }

  get registrations() {
    return this.#records.map((record) => ({ ...record, topics: [...record.topics] }));
  }

  refresh() {
    try {
      if (!this.#storage) throw new Error('Storage unavailable');
      const saved = this.#storage.getItem(STORAGE_KEY);
      const parsed = saved === null ? [] : JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('Invalid storage');
      const records = [];
      const ids = new Set();
      for (const record of parsed) {
        if (!record || typeof record !== 'object') throw new Error('Invalid record');
        const { data, errors } = validateRegistration(record, records);
        if (Object.keys(errors).length || typeof record.id !== 'string' || !record.id ||
          ids.has(record.id) || typeof record.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid record');
        ids.add(record.id);
        records.push({ ...data, id: record.id, createdAt: record.createdAt });
      }
      this.#records = records;
      this.storageWarning = '';
      return true;
    } catch {
      this.storageWarning = 'Không đọc được dữ liệu đăng ký trong trình duyệt. Dữ liệu cũ được giữ nguyên. Hãy cho phép localStorage hoặc kiểm tra dữ liệu lưu rồi tải lại trang.';
      return false;
    }
  }

  #persist(records) {
    try {
      this.#storage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      this.storageWarning = 'Không lưu được thay đổi. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn. Dữ liệu và biểu mẫu chưa bị xóa; hãy kiểm tra quyền lưu trữ rồi thử lại.';
      throw new RegistrationError({ storage: this.storageWarning });
    }
    this.#records = records;
    this.storageWarning = '';
  }

  add(raw) {
    // Đọc lại để chống trùng cả khi một tab khác vừa đăng ký.
    if (!this.refresh()) throw new RegistrationError({ storage: this.storageWarning });
    const { data, errors } = validateRegistration(raw, this.#records);
    if (Object.keys(errors).length) throw new RegistrationError(errors);
    const record = {
      ...data,
      id: globalThis.crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.#persist([...this.#records, record]);
    return { ...record, topics: [...record.topics] };
  }

  remove(id) {
    if (!this.refresh()) throw new RegistrationError({ storage: this.storageWarning });
    const next = this.#records.filter((record) => record.id !== id);
    if (next.length === this.#records.length) return false;
    this.#persist(next);
    return true;
  }

  getStats() {
    return {
      total: this.#records.length,
      inPerson: this.#records.filter((record) => record.attendance === 'in-person').length,
      online: this.#records.filter((record) => record.attendance === 'online').length,
    };
  }
}
