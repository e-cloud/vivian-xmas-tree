import { sha512 } from 'js-sha512';

import { World } from './world';

import { createMachine, createActor, assign } from 'xstate';

const preloadSection = $('#preload');
const stageLoaderSection = $('#stage-loader');

const welcomeDialog = $('#welcome-dialog');
const myNameDialog = $('#myname-dialog');
const yourNameDialog = $('#yourname-dialog');
const firstDateDialog = $('#firstdate-dialog');
const passDialog = $('#welcome-dialog');

const myNameInput = $('#myname');
const yourNameInput = $('#yourname');
const firstDateInput = $('#firstdate');
const actionClass = '.dialog__action';

const answerMachine = createMachine({
  id: 'answer',
  initial: 'void',
  entry: { type: 'enter' },
  context: {
    myName: '',
    yourName: '',
    firstDate: '',
  },
  states: {
    void: {
      on: {
        enter: 'welcome',
        revisit: 'showStage',
      },
    },
    welcome: {
      entry: () => {
        showDialog(welcomeDialog);
        welcomeDialog.find(actionClass).on('click', () => {
          actor.send({ type: 'pass' });
        });
      },
      on: {
        pass: {
          target: 'enterMyName',
          actions: () => {
            hideDialog(welcomeDialog);
            welcomeDialog.find(actionClass).off('click');
          },
        },
      },
    },
    enterMyName: {
      entry: () => {
        showDialog(myNameDialog);
        myNameDialog.find(actionClass).on('click', () => {
          const value = myNameInput.val();
          if (value != null && value.trim() != '') {
            actor.send({ type: 'pass', myName: value.trim() });
          }
        });
      },
      on: {
        pass: {
          target: 'enterYourName',
          actions: assign(({ event }) => {
            hideDialog(myNameDialog);
            myNameDialog.find(actionClass).off('click');
            return {
              myName: event.myName,
            };
          }),
        },
      },
    },
    enterYourName: {
      entry: () => {
        showDialog(yourNameDialog);
        yourNameDialog.find(actionClass).on('click', () => {
          const value = yourNameInput.val();
          if (value != null && value.trim() != '') {
            actor.send({ type: 'pass', yourName: value.trim() });
          }
        });
      },
      on: {
        pass: {
          target: 'enterFirstDate',
          actions: assign(({ event }) => {
            hideDialog(yourNameDialog);
            yourNameDialog.find(actionClass).off('click');
            return {
              yourName: event.yourName,
            };
          }),
        },
      },
    },
    enterFirstDate: {
      entry: () => {
        showDialog(firstDateDialog);
        firstDateDialog.find(actionClass).on('click', () => {
          const value = firstDateInput.val();
          if (value != null && value.trim() != '') {
            actor.send({ type: 'pass', firstDate: value.trim() });
          }
        });
      },
      on: {
        pass: {
          target: 'check',
          actions: assign(({ event }) => {
            hideDialog(firstDateDialog);
            firstDateDialog.find(actionClass).off('click');
            return {
              firstDate: event.firstDate,
            };
          }),
        },
      },
    },
    check: {
      entry() {
        actor.send({ type: 'validate' });
      },
      on: {
        validate: [
          {
            target: 'showStage',
            guard: ({ context }) => validateAccess(concatInput(context)),
          },
          { target: 'welcome' },
        ],
      },
    },
    showStage: {
      entry: ({ context }) => {
        preloadSection.fadeOut();
        stageLoaderSection.fadeIn();
        if (context.myName && context.yourName && context.firstDate) {
          localStorage.setItem('visitorInput', concatInput(context));
        }
        const world = new World({
          canvas: document.querySelector('canvas.webgl'),
          cameraPosition: { x: 0, y: 0, z: 4.5 },
        });
        world.start();
      },
      on: {
        exit: 'void',
      },
    },
  },
});

const actor = createActor(answerMachine, {
  id: 'visitor',
});
actor.subscribe(state => console.log(state.value, state.context));

actor.start();
const visitorInput = localStorage.getItem('visitorInput');
if (visitorInput && validateAccess(visitorInput)) {
  actor.send({ type: 'revisit' });
} else {
  actor.send({ type: 'enter' });
}

function concatInput(context) {
  return context.myName + context.yourName + context.firstDate;
}

function showDialog(dialog) {
  dialog.toggleClass('dialog--active');
}

function hideDialog(dialog) {
  dialog.removeClass('dialog--active');
}

function validateAccess(input) {
  return (
    sha512(input) ===
    '10fc12f3c5a2f6c26f236259d42027e88af3cc4d49c28d453f85c76747e6cd9f3db1d897c0e5d291798f489f24a2a765bfca75c16b4cb896457949b30f8a8096'
  );
}
