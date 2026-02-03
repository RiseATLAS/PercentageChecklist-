# ✨ Percentage Checklist (Sjekkliste)

A beautiful, mobile-first task management application with categories, progress tracking, and delightful animations. Built with vanilla JavaScript and Firebase.

## 🎨 Features

### Task Management
- **Create Tasks**: Add new tasks with an intuitive interface
- **Assign Responsibility**: Each task can be assigned to "Petter", "Sofie", or "Begge" (Both)
- **Edit Tasks**: Click on any task text to edit it inline
- **Complete Tasks**: Check off tasks when done, with a cute pig animation 🐷
- **Delete Tasks**: Remove tasks you no longer need
- **Sort Tasks**: Multiple sorting options:
  - Creation time (newest/oldest first)
  - Alphabetical (A-Å or Å-A)
  - By category
  - Completed status (first or last)

### Categories
- **Create Categories**: Organize your tasks into custom categories
- **Edit Categories**: Click on category names to rename them
- **Filter by Category**: View tasks from specific categories
- **Store/Retrieve Categories**: Hide completed categories and bring them back when needed
- **Category Completion**: Complete all tasks in a category to see a herd of goats 🐐
- **Smart Category Selection**: When creating multiple tasks in the same category, the category field stays selected

### Progress Tracking
- **Visual Progress Bar**: See your completion percentage at a glance
- **Real-time Updates**: Progress updates automatically as you complete tasks

### Data Persistence
- **Cloud Storage**: All data is automatically saved to Firebase
- **Real-time Sync**: Changes are saved instantly
- **Cross-device Access**: Access your tasks from any device

## 🎨 Design

- **Color Scheme**: Baby blue (#89CFF0), baby pink (#F4C2C2), and white with modern gradients
- **Mobile-First**: Optimized for touch interfaces with 44px touch targets
- **Responsive**: Works beautifully on phones, tablets, and desktops
- **Cross-Platform**: Tested and optimized for Android, iOS, and desktop browsers
- **Modern UI**: Clean design with rounded corners, smooth shadows, and elegant transitions
- **Animations**: Delightful celebrations when completing tasks
- **Accessibility**: High contrast, focus indicators, and semantic HTML

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for Firebase)

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd PercentageChecklist--main
   ```

2. **Open the application**
   - Simply open `index.html` in your web browser
   - Or use a local server:
     ```bash
     # Using Python
     python -m http.server 8000
     
     # Using Node.js
     npx serve
     ```

3. **Start using**
   - No build process required!
   - No installation needed!
   - Just open and start organizing!

## 📱 Usage

### Creating Tasks
1. Type your task in the "Legg til ny oppgave" field
2. Optionally select a category from the dropdown
3. Click the "+" button or press Enter

### Managing Tasks
- **Complete**: Click the checkbox next to a task
- **Edit**: Click on the task text to edit
- **Assign Responsibility**: Use the yellow dropdown to select "Petter", "Sofie", or "Begge" (Both)
- **Delete**: Click the "×" button
- **Change Category**: Use the blue category dropdown on each task
- **Sort**: Use the "Sorter oppgaver" dropdown to change sort order

### Working with Categories
1. Create a category using the "Lag en ny kategori" field
2. Click on category names to edit them
3. Use "📂 Gjem" to store/hide a category's tasks
4. Use "📁 Hent ut" to retrieve stored tasks
5. Click "×" to delete a category (this will delete all its tasks)

### Filtering
- Use the "Filtrer etter kategori" dropdown to view specific categories
- Click "Vis alle" to show all tasks

## 🛠️ Technical Details

### Built With
- **HTML5**: Semantic markup with accessibility in mind
- **CSS3**: Modern styling with CSS variables, gradients, and smooth animations
- **Vanilla JavaScript**: No frameworks, just clean ES6+ JavaScript
- **Firebase Realtime Database**: Cloud data storage with real-time sync
- **Google Fonts**: Roboto font family for clean typography

### Key Features
- **Real-time Error Logging**: Comprehensive console logging for debugging
- **Connection Management**: Smart reconnection logic with retry mechanism
- **Data Validation**: Input sanitization and validation on all operations
- **Offline Support**: Graceful handling of network issues
- **Performance**: Optimized rendering with document fragments
- **Modern CSS**: Gradients, shadows, transitions, and hover effects

### Browser Support
- **Desktop**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: 
  - iOS Safari (iOS 13+)
  - Chrome Mobile (Android 8+)
  - Samsung Internet
  - Firefox Mobile
- **Touch Optimized**: All buttons and interactive elements are minimum 44px for easy touch interaction
- **Responsive Design**: Automatically adapts from small phones (320px) to large desktop screens (1920px+)

### File Structure
```
PercentageChecklist--main/
├── index.html          # Main HTML file
├── app.js             # Application logic
├── styles.css         # Styling
├── assets/            # Assets folder
│   ├── young-goat.svg
│   └── young-pig.svg
└── README.md          # This file
```

## 🔐 Firebase Configuration

The app uses Firebase Realtime Database for data storage. The configuration is already set up in `app.js`. If you want to use your own Firebase project:

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Realtime Database
3. Replace the `firebaseConfig` object in `app.js` with your project's configuration
4. Update the database rules for security

## 🎯 Code Philosophy

This project follows these principles:
- **Simplicity**: Easy to read and understand
- **Maintainability**: Clean, well-documented code
- **Stability**: Avoiding unnecessary complexity
- **Mobile-First**: Touch-friendly interface
- **No Dependencies**: Pure vanilla JavaScript (except Firebase)

## 🐛 Known Issues

- Sound effects are disabled (audio files not included)
- Requires internet connection for Firebase

## 🚧 Future Enhancements

Potential features for future versions:
- Offline support with local storage fallback
- Task due dates and reminders
- Subtasks
- Task notes
- Drag and drop reordering
- Export/import functionality
- Dark mode
- Multi-user collaboration

## 📄 License

This project is available for personal and educational use.

## 🙏 Acknowledgments

- Icons: Using emoji for simple, universal icons
- Fonts: Google Fonts (Roboto)
- Backend: Firebase Realtime Database

---

**Made with ❤️ for productivity and simplicity**
