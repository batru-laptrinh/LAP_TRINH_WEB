import { RegistrationModel } from './models/registration-model.js';
import { RegistrationView } from './views/registration-view.js';
import { RegistrationController } from './controllers/registration-controller.js';

new RegistrationController(new RegistrationModel(), new RegistrationView());
