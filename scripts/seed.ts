/**
 * 초기 데이터 시딩 스크립트
 * 사용법: npx tsx scripts/seed.ts
 * 
 * 관리자 계정 1명 + 알바 계정 1명 + 매장 + 정책을 생성합니다.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDAg5gayBrbi83MussmIdPSxGyxh_kgkgk",
    authDomain: "alba-leave-mgmt.firebaseapp.com",
    projectId: "alba-leave-mgmt",
    storageBucket: "alba-leave-mgmt.firebasestorage.app",
    messagingSenderId: "759886050850",
    appId: "1:759886050850:web:ce351fb3f33c0becd97c7b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STORE_ID = 'store-001';

async function seed() {
    console.log('🌱 시드 데이터 생성 시작...');

    // 1. 매장 생성
    console.log('📍 매장 생성...');
    await setDoc(doc(db, 'stores', STORE_ID), {
        storeId: STORE_ID,
        name: '우리 매장',
        payCycle: 'monthly',
        payDay: 10,
        timezone: 'Asia/Seoul',
        createdAt: Timestamp.now(),
    });

    // 2. 관리자 계정
    console.log('👤 관리자 계정 생성...');
    const adminEmail = 'admin@test.com';
    const adminPassword = 'admin123!';
    try {
        const adminCred = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        await setDoc(doc(db, 'users', adminCred.user.uid), {
            name: '관리자',
            email: adminEmail,
            role: 'admin',
            storeId: STORE_ID,
            hourlyWage: 0,
            hireDate: Timestamp.fromDate(new Date('2025-01-01')),
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        console.log(`  ✅ 관리자: ${adminEmail} / ${adminPassword} (uid: ${adminCred.user.uid})`);
    } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
            console.log('  ⚠️ 관리자 계정이 이미 존재합니다.');
        } else {
            throw err;
        }
    }

    // 3. 알바 계정
    console.log('👤 알바 계정 생성...');
    const workerEmail = 'worker@test.com';
    const workerPassword = 'worker123!';
    try {
        const workerCred = await createUserWithEmailAndPassword(auth, workerEmail, workerPassword);
        await setDoc(doc(db, 'users', workerCred.user.uid), {
            name: '김알바',
            email: workerEmail,
            role: 'worker',
            storeId: STORE_ID,
            hourlyWage: 9860,
            hireDate: Timestamp.fromDate(new Date('2025-06-01')),
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        console.log(`  ✅ 알바: ${workerEmail} / ${workerPassword} (uid: ${workerCred.user.uid})`);
    } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
            console.log('  ⚠️ 알바 계정이 이미 존재합니다.');
        } else {
            throw err;
        }
    }

    // 4. 연차 정책
    console.log('📋 연차 정책 생성...');
    await setDoc(doc(db, 'leavePolicy', STORE_ID), {
        policyId: STORE_ID,
        storeId: STORE_ID,
        minWeeklyHours: 15,
        accrualMode: 'fixed',
        accrualFixedHours: 8,
        accrualRatio: null,
        maxAccumulatedHours: 0,
        displayDayHours: 8,
        enabled: true,
        updatedBy: 'seed',
        updatedAt: Timestamp.now(),
    });

    console.log('\n🎉 시드 데이터 생성 완료!');
    console.log('──────────────────────────────');
    console.log('관리자 로그인: admin@test.com / admin123!');
    console.log('알바 로그인:   worker@test.com / worker123!');
    console.log('──────────────────────────────');

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ 시드 실패:', err);
    process.exit(1);
});
