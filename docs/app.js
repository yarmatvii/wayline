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
  if (nextPage === 'journeys' && !videoView.hidden) playVideo();
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
const videoError = byId('video-error');
const videoList = byId('journeys-list');
const videoView = byId('video-view');
const video = byId('local-video');
const ticket = byId('open-video');
let videoUrl;
let videoFailed = false;

byId('add-video').addEventListener('click', () => {
  feedback(videoPickError);
  videoDialog.showModal();
});
byId('pick-video').addEventListener('click', () => videoInput.click());

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
  byId('journeys-empty').hidden = true;
  ticket.hidden = false;
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
  videoList.hidden = true;
  videoView.hidden = false;
  screen.scrollTop = 0;
  playVideo();
  byId('back-to-journeys').focus();
});

byId('back-to-journeys').addEventListener('click', () => {
  video.pause();
  videoView.hidden = true;
  videoList.hidden = false;
  ticket.focus();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && activePage === 'journeys' && !videoView.hidden) playVideo();
});
byId('refresh').addEventListener('click', () => {
  byId('refresh-status').textContent = 'Checked this session. No trips exist.';
});

const profileDialog = byId('profile-dialog');
const photoInput = byId('photo-file');
const pickPhoto = byId('pick-photo');
const savedPhoto = byId('saved-photo');
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

async function storeProfileValue(key, value) {
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
  savedPhoto.hidden = false;
  byId('empty-photo').hidden = true;
  pickPhoto.querySelector('[data-photo-label]').textContent = 'Replace photo';
  if (previousUrl) URL.revokeObjectURL(previousUrl);
}

async function readProfile() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('profile', 'readonly');
    const store = transaction.objectStore('profile');
    const name = store.get('name');
    const photo = store.get('photo');
    transaction.oncomplete = () => resolve({name: name.result, photo: photo.result});
    transaction.onabort = () => reject(transaction.error);
  });
}

const initialProfile = readProfile().then(({name, photo}) => {
  if (typeof name === 'string') {
    const typedName = profileDialog.open && nameInput.value;
    showName(name);
    if (typedName) nameInput.value = typedName;
  }
  if (photo instanceof Blob) showPhoto(URL.createObjectURL(photo));
}).catch(() => feedback(photoStatus, 'Saved profile details could not be read.'));

byId('open-profile').addEventListener('click', () => {
  nameInput.value = currentName;
  feedback(nameStatus);
  profileDialog.showModal();
});

pickPhoto.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  photoInput.value = '';
  if (!file) return;

  pickPhoto.disabled = true;
  feedback(photoStatus);
  const candidateUrl = URL.createObjectURL(file);
  try {
    const candidate = new Image();
    candidate.src = candidateUrl;
    await candidate.decode();
  } catch {
    feedback(photoStatus, 'This photo could not be opened. Try a JPEG, PNG, or another photo.');
    URL.revokeObjectURL(candidateUrl);
    pickPhoto.disabled = false;
    return;
  }

  try {
    await initialProfile;
    await storeProfileValue('photo', file);
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
    await initialProfile;
    await storeProfileValue('name', name);
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
