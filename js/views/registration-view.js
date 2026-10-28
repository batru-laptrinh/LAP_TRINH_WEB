// VIEW: đọc biểu mẫu và hiển thị dữ liệu; không tự lưu localStorage.
import { AUDIENCES, ATTENDANCE, TOPICS } from '../models/registration-model.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export class RegistrationView {
  constructor() {
    this.form = document.querySelector('#registration-form');
    this.list = document.querySelector('#registrations-list');
    this.result = document.querySelector('#registration-result');
    this.status = document.querySelector('#form-status');
    this.menu = document.querySelector('#primary-menu');
    this.menuToggle = document.querySelector('#menu-toggle');
    this.resultId = null;
  }

  readForm() {
    const values = new FormData(this.form);
    return {
      fullName: values.get('fullName'),
      email: values.get('email'),
      phone: values.get('phone'),
      organization: values.get('organization'),
      audience: values.get('audience'),
      attendance: values.get('attendance'),
      topics: values.getAll('topics'),
      notes: values.get('notes'),
      consent: values.has('consent'),
    };
  }

  showErrors(errors = {}) {
    this.form.querySelectorAll('[data-field]').forEach((group) => {
      const message = errors[group.dataset.field];
      const output = group.querySelector('[data-error]');
      if (output) output.textContent = message || '';
      group.classList.toggle('is-invalid', Boolean(message));
      group.querySelectorAll('input, select, textarea').forEach((input) => {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      });
    });
    if (Object.keys(errors).length) {
      this.setStatus(errors.storage || 'Đăng ký chưa được lưu. Vui lòng kiểm tra các mục có thông báo lỗi.');
      this.form.querySelector('[aria-invalid="true"]')?.focus();
    }
  }

  setStatus(message) {
    this.status.textContent = message;
  }

  showStorageWarning(message) {
    document.querySelector('#storage-status').textContent = message;
  }

  clearConfirmation() {
    this.result.replaceChildren();
    this.resultId = null;
  }

  showConfirmation(record) {
    this.clearConfirmation();
    this.resultId = record.id;
    const box = element('div', undefined, 'success-message');
    box.append(element('h3', 'Đăng ký thành công'));
    const details = element('dl', undefined, 'registration-details');
    for (const [label, value] of [
      ['Họ và tên', record.fullName], ['Email', record.email],
      ['Đơn vị', record.organization], ['Hình thức', ATTENDANCE[record.attendance]],
    ]) details.append(element('dt', label), element('dd', value));
    box.append(details, element('p', 'Thông tin chỉ được lưu trên trình duyệt này, chưa gửi đến ban tổ chức.'));
    this.result.append(box);
  }

  renderRegistrations(records, stats) {
    document.querySelector('#total-count').textContent = stats.total;
    document.querySelector('#in-person-count').textContent = stats.inPerson;
    document.querySelector('#online-count').textContent = stats.online;
    if (this.resultId && !records.some((record) => record.id === this.resultId)) this.clearConfirmation();
    this.list.replaceChildren();
    if (!records.length) {
      this.list.append(element('p', 'Chưa có đăng ký nào được lưu trên trình duyệt này.', 'empty-state'));
      return;
    }
    for (const record of [...records].reverse()) {
      const card = element('article', undefined, 'registration-card');
      const header = element('div', undefined, 'registration-card__header');
      const heading = element('h3', record.fullName);
      const button = element('button', 'Xóa đăng ký', 'delete-button');
      button.type = 'button';
      button.dataset.deleteId = record.id;
      button.setAttribute('aria-label', `Xóa đăng ký của ${record.fullName}`);
      header.append(heading, button);
      const details = element('dl', undefined, 'registration-details');
      for (const [label, value] of [
        ['Email', record.email], ['Điện thoại', record.phone],
        ['Đơn vị', record.organization], ['Đối tượng', AUDIENCES[record.audience]],
        ['Hình thức', ATTENDANCE[record.attendance]],
        ['Chủ đề', record.topics.map((topic) => TOPICS[topic]).join(', ')],
      ]) details.append(element('dt', label), element('dd', value));
      if (record.notes) details.append(element('dt', 'Ghi chú'), element('dd', record.notes));
      card.append(header, details);
      this.list.append(card);
    }
  }

  updateNotesCount() {
    const notes = this.form.elements.namedItem('notes');
    document.querySelector('#notes-count').textContent = `${[...notes.value].length}/300`;
  }

  resetForm() {
    this.form.reset();
    this.updateNotesCount();
  }

  setMenu(open) {
    this.menu.classList.toggle('is-open', open);
    this.menuToggle.setAttribute('aria-expanded', String(open));
    this.menuToggle.textContent = open ? 'Đóng menu' : 'Mở menu';
  }
}
