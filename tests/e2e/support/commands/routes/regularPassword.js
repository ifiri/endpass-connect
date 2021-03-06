import { responseSuccess } from '@fixtures/response';
import { identityAPIUrl } from '@config';

Cypress.Commands.add('mockRegularPasswordCheck', (status = 200) => {
  cy.route({
    method: 'POST',
    url: `${identityAPIUrl}/regular-password/check`,
    status,
    response: {},
  }).as('routeRegularPasswordCheck');
});

Cypress.Commands.add('mockRegularPasswordReset', (status = 200) => {
  cy.route({
    method: 'POST',
    url: `${identityAPIUrl}/regular-password/reset`,
    status,
    response: {},
  }).as('routeRegularPasswordReset');
});

Cypress.Commands.add('mockRegularPasswordResetConfirm', (status = 200) => {
  cy.route({
    method: 'POST',
    url: `${identityAPIUrl}/regular-password/reset/confirm`,
    status,
    response: responseSuccess,
  }).as('routeRegularPasswordResetConfirm');
});
