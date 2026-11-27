'use strict';

const byId = (id) => document.getElementById(id);
const screen = byId('main');
const dock = document.querySelector('.dock');
const navigation = [...dock.querySelectorAll('[data-page]')];
const scrollPositions = new Map();
let activePage = 'booking';

function showPage(nextPage) {
  if (nextPage === activePage) return;
  scrollPositions.set(activePage, screen.scrollTop);
  byId(activePage).hidden = true;
  byId(nextPage).hidden = false;
  navigation.find((button) => button.dataset.page === activePage).removeAttribute('aria-current');
  navigation.find((button) => button.dataset.page === nextPage).setAttribute('aria-current', 'page');
  activePage = nextPage;
  dock.dataset.active = nextPage;
  screen.scrollTop = scrollPositions.get(nextPage) ?? 0;
}

navigation.forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.page));
});

function feedback(element, message = '') {
  element.textContent = message;
  element.hidden = !message;
}

const videoDialog = byId('video-dialog');
const videoInput = byId('video-file');
const videoPickError = byId('video-pick-error');
const ticketPhotoInput = byId('ticket-photo-file');
const pickTicketPhoto = byId('pick-ticket-photo');
const ticketPhotoStatus = byId('ticket-photo-status');
const videoError = byId('video-error');
const videoView = byId('video-view');
const ticketMedia = byId('ticket-media');
const video = byId('local-video');
const ticket = byId('open-video');
const ticketEntry = byId('journeys-ticket');
const ticketPhotoImage = byId('ticket-photo');
let videoUrl;
let videoFailed = false;
let ticketPhotoUrl;

function updateTicketEntry() {
  const hasMedia = Boolean(videoUrl || ticketPhotoUrl);
  byId('journeys-empty').hidden = hasMedia;
  ticketEntry.hidden = !hasMedia;
  ticketMedia.hidden = !videoUrl;
}

function showTicketPhoto(url) {
  const previousUrl = ticketPhotoUrl;
  ticketPhotoUrl = url;
  ticketPhotoImage.src = url;
  ticketPhotoImage.hidden = false;
  byId('ticket-photo-label').textContent = 'Replace ticket photo';
  updateTicketEntry();
  if (previousUrl) URL.revokeObjectURL(previousUrl);
}

byId('add-video').addEventListener('click', () => {
  feedback(videoPickError);
  feedback(ticketPhotoStatus);
  videoDialog.showModal();
});
byId('pick-video').addEventListener('click', () => videoInput.click());
pickTicketPhoto.addEventListener('click', () => ticketPhotoInput.click());

videoInput.addEventListener('change', () => {
  const file = videoInput.files[0];
  videoInput.value = '';
  if (!file) return;
  if (!file.size || (file.type && !file.type.startsWith('video/') && !/\.(mov|mp4|m4v|webm|ogv)$/i.test(file.name))) {
    feedback(videoPickError, 'Choose a video file such as an MP4 or MOV.');
    return;
  }

  const previousUrl = videoUrl;
  videoUrl = URL.createObjectURL(file);
  videoFailed = false;
  video.src = videoUrl;
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  feedback(videoError);
  updateTicketEntry();
  videoDialog.close();
  ticket.focus();
});

function playVideo() {
  if (!videoUrl || videoFailed) return;
  const requestedUrl = videoUrl;
  feedback(videoError);
  video.play().catch((error) => {
    if (requestedUrl === videoUrl && error.name === 'NotAllowedError') {
      feedback(videoError, 'Playback was blocked. Go back and open the video again.');
    }
  });
}

video.addEventListener('error', () => {
  if (!video.error) return;
  videoFailed = true;
  feedback(videoError, 'This video could not be played. Go back and choose another file, such as an H.264 MP4.');
});

ticket.addEventListener('click', () => {
  videoView.showModal();
  videoView.scrollTop = 0;
  playVideo();
});

byId('back-to-journeys').addEventListener('click', () => {
  videoView.close();
});
videoView.addEventListener('close', () => video.pause());

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && videoView.open) playVideo();
});
byId('refresh').addEventListener('click', () => {
  byId('refresh-status').textContent = 'Checked this session. No trips exist.';
});

const profileDialog = byId('profile-dialog');
const photoInput = byId('photo-file');
const pickPhoto = byId('pick-photo');
const savedPhoto = byId('saved-photo');
const profileCard = byId('open-profile');
const photoViewer = byId('photo-viewer');
const fullscreenPhoto = byId('fullscreen-photo');
const photoStatus = byId('photo-status');
const nameForm = byId('name-form');
const nameInput = byId('name');
const nameStatus = byId('name-status');
const displayName = byId('display-name');
const defaultName = displayName.textContent;
let databasePromise;
let currentName = '';
let photoUrl;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('wayline-profile', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profile');
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

async function storeLocalValue(key, value) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('profile', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore('profile').put(value, key);
  });
  navigator.storage?.persist?.().catch(() => {});
}

function showName(name) {
  currentName = name;
  displayName.textContent = name || defaultName;
  nameInput.value = name;
}

function showPhoto(url) {
  const previousUrl = photoUrl;
  photoUrl = url;
  savedPhoto.src = url;
  fullscreenPhoto.src = url;
  savedPhoto.hidden = false;
  byId('empty-photo').hidden = true;
  profileCard.removeAttribute('aria-disabled');
  pickPhoto.querySelector('[data-photo-label]').textContent = 'Replace photo';
  if (previousUrl) URL.revokeObjectURL(previousUrl);
}

async function readLocalValues() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('profile', 'readonly');
    const store = transaction.objectStore('profile');
    const name = store.get('name');
    const photo = store.get('photo');
    const ticketPhoto = store.get('ticketPhoto');
    transaction.oncomplete = () => resolve({name: name.result, photo: photo.result, ticketPhoto: ticketPhoto.result});
    transaction.onabort = () => reject(transaction.error);
  });
}

const initialData = readLocalValues().then(({name, photo, ticketPhoto}) => {
  if (typeof name === 'string') {
    const typedName = profileDialog.open && nameInput.value;
    showName(name);
    if (typedName) nameInput.value = typedName;
  }
  if (photo instanceof Blob) showPhoto(URL.createObjectURL(photo));
  if (ticketPhoto instanceof Blob) showTicketPhoto(URL.createObjectURL(ticketPhoto));
}).catch(() => feedback(photoStatus, 'Saved profile details could not be read.'));

async function decodePhoto(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return url;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

ticketPhotoInput.addEventListener('change', async () => {
  const file = ticketPhotoInput.files[0];
  ticketPhotoInput.value = '';
  if (!file) return;

  pickTicketPhoto.disabled = true;
  feedback(ticketPhotoStatus);
  let candidateUrl;
  try {
    candidateUrl = await decodePhoto(file);
    await initialData;
    await storeLocalValue('ticketPhoto', file);
    showTicketPhoto(candidateUrl);
    feedback(ticketPhotoStatus, 'Ticket photo saved on this device.');
  } catch {
    if (candidateUrl) {
      URL.revokeObjectURL(candidateUrl);
      feedback(ticketPhotoStatus, 'Could not save this photo on the device.');
    } else {
      feedback(ticketPhotoStatus, 'This photo could not be opened. Try a JPEG or PNG.');
    }
  } finally {
    pickTicketPhoto.disabled = false;
  }
});

byId('edit-profile').addEventListener('click', () => {
  nameInput.value = currentName;
  feedback(nameStatus);
  profileDialog.showModal();
});

profileCard.addEventListener('click', () => {
  if (!photoUrl || photoViewer.open) return;
  if (!history.state?.waylinePhoto) {
    history.pushState({...history.state, waylinePhoto: true}, '');
  }
  photoViewer.showModal();
});

function closePhotoViewer() {
  photoViewer.close();
  if (history.state?.waylinePhoto) history.back();
}

photoViewer.addEventListener('cancel', (event) => {
  event.preventDefault();
  closePhotoViewer();
});
window.addEventListener('popstate', () => {
  if (history.state?.waylinePhoto) {
    if (photoUrl && !photoViewer.open) photoViewer.showModal();
  } else if (photoViewer.open) {
    photoViewer.close();
  }
});

let photoSwipeStart;
photoViewer.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  photoSwipeStart = {id: event.pointerId, x: event.clientX, y: event.clientY};
  photoViewer.setPointerCapture(event.pointerId);
});
photoViewer.addEventListener('pointerup', (event) => {
  if (photoSwipeStart?.id !== event.pointerId) return;
  const dx = event.clientX - photoSwipeStart.x;
  const dy = event.clientY - photoSwipeStart.y;
  photoSwipeStart = undefined;
  if ((dx > 55 && dx > Math.abs(dy)) || (dy > 65 && dy > Math.abs(dx))) {
    closePhotoViewer();
  }
});
photoViewer.addEventListener('pointercancel', () => { photoSwipeStart = undefined; });

pickPhoto.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  photoInput.value = '';
  if (!file) return;

  pickPhoto.disabled = true;
  feedback(photoStatus);
  let candidateUrl;
  try {
    candidateUrl = await decodePhoto(file);
  } catch {
    feedback(photoStatus, 'This photo could not be opened. Try a JPEG, PNG, or another photo.');
    pickPhoto.disabled = false;
    return;
  }

  try {
    await initialData;
    await storeLocalValue('photo', file);
    showPhoto(candidateUrl);
    feedback(photoStatus, 'Photo saved on this device.');
  } catch {
    URL.revokeObjectURL(candidateUrl);
    feedback(photoStatus, 'Could not save this photo on the device.');
  } finally {
    pickPhoto.disabled = false;
  }
});

nameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    feedback(nameStatus, 'Enter a name first.');
    nameInput.focus();
    return;
  }
  const saveButton = nameForm.querySelector('button');
  saveButton.disabled = true;
  nameInput.readOnly = true;
  try {
    await initialData;
    await storeLocalValue('name', name);
    showName(name);
    feedback(nameStatus, 'Name saved on this device.');
  } catch {
    feedback(nameStatus, 'Could not save the name on this device.');
  } finally {
    saveButton.disabled = false;
    nameInput.readOnly = false;
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { byId('offline-status').hidden = false; })
    .catch(() => {});
}
