// CONTROLLER: điều phối sự kiện giữa Model và View.
import { RegistrationError, STORAGE_KEY } from '../models/registration-model.js';

export class RegistrationController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.bindEvents();
    this.render();
  }

  render() {
    this.view.renderRegistrations(this.model.registrations, this.model.getStats());
    this.view.showStorageWarning(this.model.storageWarning);
  }

  bindEvents() {
    this.view.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.view.clearConfirmation();
      this.view.showErrors();
      try {
        const record = this.model.add(this.view.readForm());
        this.render();
        this.view.showConfirmation(record);
        this.view.resetForm();
        this.view.setStatus('Đã lưu đăng ký thành công trên trình duyệt này.');
      } catch (error) {
        if (!(error instanceof RegistrationError)) throw error;
        this.render();
        this.view.showErrors(error.errors);
      }
    });

    this.view.form.elements.namedItem('notes').addEventListener('input', () => this.view.updateNotesCount());

    this.view.list.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-delete-id]');
      if (!button) return;
      const record = this.model.registrations.find((item) => item.id === button.dataset.deleteId);
      if (!record || !window.confirm(`Bạn có chắc muốn xóa đăng ký của ${record.fullName} (${record.email})?`)) return;
      try {
        const removed = this.model.remove(record.id);
        this.render();
        this.view.setStatus(removed ? 'Đã xóa đăng ký và cập nhật thống kê.' : 'Đăng ký này đã được xóa ở tab khác.');
        document.querySelector('#registration-results')?.focus();
      } catch (error) {
        if (!(error instanceof RegistrationError)) throw error;
        this.render();
        this.view.setStatus(error.message);
      }
    });

    this.view.menuToggle.addEventListener('click', () => {
      this.view.setMenu(this.view.menuToggle.getAttribute('aria-expanded') !== 'true');
    });
    this.view.menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => this.view.setMenu(false));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.view.menuToggle.getAttribute('aria-expanded') === 'true') {
        this.view.setMenu(false);
        this.view.menuToggle.focus();
      }
    });
    window.matchMedia('(min-width: 801px)').addEventListener('change', () => this.view.setMenu(false));
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        this.model.refresh();
        this.render();
      }
    });
  }
}
