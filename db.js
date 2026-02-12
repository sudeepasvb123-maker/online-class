/**
 * Mock Database Service using LocalStorage
 * Simulates a backend for MathMaster
 */

const DB_KEY = 'mathmaster_db_v1';

// Initial Seed Data
// Initial Seed Data
const seedData = {
    users: [
        {
            id: 'admin',
            role: 'teacher',
            contact: 'sudeepasvb123@gmail.com', // Special case for admin
            name: 'Mr. Teacher'
        },
        {
            id: 'std1',
            role: 'student',
            contact: 'student@gmail.com',
            phone: '0771234567',
            barcode: 'SWX4567', // Mock barcode
            name: 'Saman Perera',
            grade: '10',
            payments: ['2023-10', '2023-11', '2023-12', '2024-01']
        }
    ],
    // ... rest of content and marks remains same ...
    content: [
        {
            id: 'c1',
            type: 'link',
            title: 'Sunday Geometry Class (Live)',
            details: 'Click to join via Zoom',
            url: 'https://zoom.us',
            grade: '10',
            date: '2024-02-10'
        },
        {
            id: 'c2',
            type: 'pdf',
            title: 'Algebra Tute 01',
            details: 'Download and complete exercises 1-5',
            url: '#',
            grade: '10',
            date: '2024-02-05'
        },
        {
            id: 'c3',
            type: 'recording',
            title: 'Trigonometry Part 1',
            details: 'Watch the full recap of last week',
            url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            grade: '10',
            date: '2024-01-28'
        }
    ],
    marks: [
        { studentId: 'std1', exam: 'Term Test 1', score: 75, total: 100 },
        { studentId: 'std1', exam: 'Unit Test: Algebra', score: 88, total: 100 },
        { studentId: 'std1', exam: 'Term Test 2', score: 92, total: 100 }
    ],
    otps: {} // Store ephemeral OTPs: { '077...': '1234' }
};

class Database {
    constructor() {
        this.init();
    }

    init() {
        // Load or Seed
        if (!localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, JSON.stringify(seedData));
        }

        // FIX: Force update admin email in case of old data
        const data = this.getData();
        const adminEmail = 'sudeepasvb123@gmail.com';

        // 1. Update Admin
        const admin = data.users.find(u => u.id === 'admin');
        if (admin) {
            admin.contact = adminEmail;
        }

        // 2. Remove any student accounts that might have clashed with admin email
        data.users = data.users.filter(u => u.id === 'admin' || u.contact !== adminEmail);

        // 3. MIGRATION: Fix missing barcodes for existing students
        data.users.forEach(u => {
            if (u.role === 'student' && !u.barcode) {
                // If grade is missing, default to 10
                const grade = u.grade || '10';
                u.barcode = this.generateBarcode(grade);
            }
        });

        this.saveData(data);
    }

    getData() {
        const data = JSON.parse(localStorage.getItem(DB_KEY));
        // Ensure settings exist (migration for old data)
        if (!data.settings) {
            data.settings = {
                facebook: 'https://www.facebook.com',
                youtube: 'https://www.youtube.com'
            };
            this.saveData(data);
        }
        return data;
    }

    saveData(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    }

    // --- Auth with OTP ---

    // Simulate sending OTP
    sendOTP(contact) {
        const data = this.getData();
        const user = data.users.find(u => u.contact === contact);

        if (!user) {
            return { success: false, message: 'User not found. Please register first.' };
        }

        // Generate a random 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Save OTP momentarily (in valid app this relies on backend/redis)
        // We will store it in the data object for this simulation
        if (!data.otps) data.otps = {};
        data.otps[contact] = otp;
        this.saveData(data);

        // In a real app, this sends SMS/Email. 
        // HERE: We return it to display in an alert for the user to test.
        return { success: true, message: 'OTP Sent!', debugOtp: otp };
    }

    loginWithOTP(contact, otp) {
        const data = this.getData();
        const storedOtp = data.otps ? data.otps[contact] : null;

        // Backdoor for admin
        if (contact === 'admin' && otp === '123') {
            const user = data.users.find(u => u.contact === 'admin');
            localStorage.setItem('mathmaster_user', JSON.stringify(user));
            return { success: true, user };
        }

        if (storedOtp && storedOtp === otp) {
            const user = data.users.find(u => u.contact === contact);
            // Clear OTP
            delete data.otps[contact];
            this.saveData(data);

            localStorage.setItem('mathmaster_user', JSON.stringify(user));
            return { success: true, user };
        }

        return { success: false, message: 'Invalid OTP' };
    }

    // --- Google Auth Simulation ---
    loginWithGoogle(email) {
        const data = this.getData();
        const user = data.users.find(u => u.contact === email);

        if (user) {
            localStorage.setItem('mathmaster_user', JSON.stringify(user));
            return { success: true, user };
        }

        // Return signal that this is a new user
        return { success: false, status: 'new_user', email };
    }

    completeGoogleRegistration(details) {
        const data = this.getData();
        const barcode = this.generateBarcode(details.grade);

        const newUser = {
            id: 'std' + Date.now(),
            role: 'student',
            contact: details.email,
            phone: details.phone,
            name: details.name,
            school: details.school,
            grade: details.grade,
            barcode: barcode,
            payments: []
        };
        data.users.push(newUser);
        this.saveData(data);

        localStorage.setItem('mathmaster_user', JSON.stringify(newUser));
        return { success: true, user: newUser };
    }

    refreshSession() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return null;
        const data = this.getData();
        const freshUser = data.users.find(u => u.id === currentUser.id);
        if (freshUser) {
            localStorage.setItem('mathmaster_user', JSON.stringify(freshUser));
            return freshUser;
        }
        return currentUser;
    }

    generateBarcode(grade) {
        let gradeChar = grade;
        if (grade === '10') gradeChar = 'A';
        if (grade === '11') gradeChar = 'B';

        // Random 4 digits
        const rand = Math.floor(1000 + Math.random() * 9000).toString();
        return `SW${gradeChar}${rand}`;
    }

    updateUser(userId, updates) {
        const data = this.getData();
        const userIndex = data.users.findIndex(u => u.id === userId);

        if (userIndex !== -1) {
            // Update fields
            if (updates.name) data.users[userIndex].name = updates.name;
            if (updates.school) data.users[userIndex].school = updates.school;
            if (updates.phone) data.users[userIndex].phone = updates.phone;

            this.saveData(data);

            // Update session if it's the current user
            const sessionUser = this.getCurrentUser();
            if (sessionUser && sessionUser.id === userId) {
                if (updates.name) sessionUser.name = updates.name;
                if (updates.school) sessionUser.school = updates.school;
                if (updates.phone) {
                    sessionUser.phone = updates.phone;
                    // Sync barcode from updated DB user
                    const updatedDbUser = data.users[userIndex];
                    sessionUser.barcode = updatedDbUser.barcode;
                }
                localStorage.setItem('mathmaster_user', JSON.stringify(sessionUser));
            }

            return { success: true };
        }
        return { success: false, message: 'User not found' };
    }

    removeUser(userId) {
        const data = this.getData();
        const initialLength = data.users.length;
        data.users = data.users.filter(u => u.id !== userId);

        if (data.users.length < initialLength) {
            this.saveData(data);
            return { success: true };
        }
        return { success: false, message: 'User not found' };
    }

    removePayment(userId, month) {
        const data = this.getData();
        const user = data.users.find(u => u.id === userId);

        if (user) {
            const index = user.payments.indexOf(month);
            if (index > -1) {
                user.payments.splice(index, 1);
                this.saveData(data);
                return { success: true };
            }
            return { success: false, message: 'Payment record not found' };
        }
        return { success: false, message: 'User not found' };
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('mathmaster_user'));
    }

    logout() {
        localStorage.removeItem('mathmaster_user');
        window.location.href = 'index.html';
    }

    register(studentData) {
        const data = this.getData();
        if (data.users.find(u => u.contact === studentData.contact)) {
            return { success: false, message: 'Phone/Email already registered' };
        }
        const newUser = {
            id: 'std' + Date.now(),
            role: 'student',
            payments: [],
            ...studentData
        };
        data.users.push(newUser);
        this.saveData(data);
        return { success: true };
    }

    // --- Content ---
    getContent(grade) {
        const data = this.getData();
        // Filter by grade
        return data.content.filter(c => c.grade === grade);
    }

    getAllContent() {
        return this.getData().content;
    }

    addContent(contentItem) {
        const data = this.getData();
        contentItem.id = 'c' + Date.now();
        contentItem.date = new Date().toISOString().split('T')[0];
        data.content.unshift(contentItem);
        this.saveData(data);
        return { success: true };
    }

    deleteContent(id) {
        const data = this.getData();
        data.content = data.content.filter(c => c.id !== id);
        this.saveData(data);
        return { success: true };
    }

    // --- Students & Payments ---
    getAllStudents() {
        const data = this.getData();
        return data.users.filter(u => u.role === 'student');
    }

    addPayment(studentId, month) {
        const data = this.getData();
        const student = data.users.find(u => u.id === studentId);
        if (student) {
            if (!student.payments.includes(month)) {
                student.payments.push(month);
                this.saveData(data);
                return { success: true };
            }
            return { success: false, message: 'Payment already recorded' };
        }
        return { success: false, message: 'Student not found' };
    }

    checkPayment(studentId) {
        const data = this.getData();
        const student = data.users.find(u => u.id === studentId);
        if (!student) return false;

        // Simple logic: Check if current month is paid
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        return student.payments.includes(currentMonth);
    }

    // --- Marks ---
    addMark(markData) {
        const data = this.getData();
        data.marks.push(markData);
        this.saveData(data);
    }

    getStudentMarks(studentId) {
        const data = this.getData();
        return data.marks.filter(m => m.studentId === studentId);
    }

    // --- Settings (Social Links) ---
    getSettings() {
        const data = this.getData();
        return data.settings || { facebook: '#', youtube: '#' };
    }

    updateSettings(newSettings) {
        const data = this.getData();
        // Merge specific fields to avoid overwriting unrelated settings if any
        if (!data.settings) data.settings = {};
        if (newSettings.facebook !== undefined) data.settings.facebook = newSettings.facebook;
        if (newSettings.youtube !== undefined) data.settings.youtube = newSettings.youtube;

        this.saveData(data);
        return { success: true };
    }
}

const db = new Database();
