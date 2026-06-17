"use client";

import React, { useState } from "react";
import { 
  BookOpen, 
  Award, 
  CheckCircle, 
  Clock, 
  FileCheck2, 
  ArrowRight, 
  Sparkles,
  Trophy,
  BrainCircuit
} from "lucide-react";
import confetti from "canvas-confetti";

interface Course {
  id: string;
  title: string;
  category: string;
  duration: string;
  creditHours: number;
  progress: number;
  completed: boolean;
  quizQuestions: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

interface Certification {
  id: string;
  courseTitle: string;
  certifiedDate: string;
  score: number;
  certHash: string;
}

export default function AcademyLMS() {
  const [courses, setCourses] = useState<Course[]>([
    {
      id: "course-1",
      title: "ISO 13485 Quality Management for Orthodontic Devices",
      category: "Regulatory & Quality",
      duration: "4.5 hours",
      creditHours: 4.5,
      progress: 100,
      completed: true,
      quizQuestions: [
        {
          question: "Which ISO standard specifies requirements for a quality management system for medical devices?",
          options: ["ISO 9001", "ISO 13485", "ISO 14001", "ISO 45001"],
          correctIndex: 1
        }
      ]
    },
    {
      id: "course-2",
      title: "Periodontal Ligament (PDL) Stress Tensor Biomechanics",
      category: "Clinical AI Science",
      duration: "3 hours",
      creditHours: 3.0,
      progress: 60,
      completed: false,
      quizQuestions: [
        {
          question: "What is the biological safety stress threshold of the Periodontal Ligament (PDL) to avoid resorption?",
          options: ["5.0 kPa", "15.0 kPa", "45.0 kPa", "100.0 kPa"],
          correctIndex: 1
        },
        {
          question: "In the linear elastic PDL model, what equation calculates stress (sigma)?",
          options: ["σ = E * ε", "σ = F / d", "σ = E * A", "σ = G * θ"],
          correctIndex: 0
        }
      ]
    },
    {
      id: "course-3",
      title: "Zero-Trust HIPAA Architectures & Data Residency Controls",
      category: "Enterprise Security",
      duration: "2 hours",
      creditHours: 2.0,
      progress: 0,
      completed: false,
      quizQuestions: [
        {
          question: "Which technology enforces validation at every authentication step in a zero-trust network?",
          options: ["WAF", "mTLS (mutual TLS) and JWT signatures", "IP Whitelists", "Static API Keys"],
          correctIndex: 1
        }
      ]
    }
  ]);

  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState<boolean | null>(null);
  
  const [certifications, setCertifications] = useState<Certification[]>([
    {
      id: "cert-98",
      courseTitle: "ISO 13485 Quality Management for Orthodontic Devices",
      certifiedDate: "2026-06-11 UTC",
      score: 100,
      certHash: "8b7e6d5c4b3a2a10f9e8d7c6b5a49382f7e6d5c4b3a2a10f9e8d7c6b5a49382f"
    }
  ]);

  const handleStartQuiz = (courseId: string) => {
    setActiveCourseId(courseId);
    setQuizAnswers({});
    setQuizScore(null);
    setQuizPassed(null);
  };

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    setQuizAnswers({
      ...quizAnswers,
      [questionIndex]: optionIndex
    });
  };

  const handleSubmitQuiz = (course: Course) => {
    let correctCount = 0;
    course.quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) {
        correctCount++;
      }
    });

    const percentage = Math.round((correctCount / course.quizQuestions.length) * 100);
    const passed = percentage >= 70;

    setQuizScore(percentage);
    setQuizPassed(passed);

    if (passed) {
      // Trigger canvas-confetti celebratory burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#14b8a6", "#0d9488", "#2dd4bf"]
      });

      // Mark course as completed
      setCourses(courses.map(c => c.id === course.id ? { ...c, progress: 100, completed: true } : c));

      // Append new certification record
      const newCert: Certification = {
        id: `cert-${Math.floor(Math.random() * 900) + 100}`,
        courseTitle: course.title,
        certifiedDate: new Date().toISOString().split("T")[0] + " UTC",
        score: percentage,
        certHash: `f1a8e94cb02c91845a90d8a57e3f421b${Math.floor(Math.random() * 1000)}`
      };
      setCertifications([newCert, ...certifications]);
    }
  };

  const selectedCourse = courses.find(c => c.id === activeCourseId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Course List / Active Quiz Workspace */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <BookOpen size={20} className="text-teal-400" />
                MyOrtho CME Continuing Education Academy
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Earn clinical, security, and quality certifications to unlock advanced alignment export tools.</p>
            </div>
          </div>

          {selectedCourse ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block">{selectedCourse.category}</span>
                  <h4 className="font-bold text-sm text-primary mt-1">{selectedCourse.title}</h4>
                </div>
                <button
                  onClick={() => setActiveCourseId(null)}
                  className="px-3 py-1.5 border border-border hover:bg-slate-900 rounded-lg"
                >
                  Back to Courses
                </button>
              </div>

              {quizPassed === null ? (
                <div className="space-y-5">
                  <h5 className="font-bold text-xs text-primary flex items-center gap-1.5">
                    <BrainCircuit size={14} className="text-teal-400" /> Interactive Examination
                  </h5>

                  {selectedCourse.quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-slate-900/10 border border-border rounded-xl p-4 space-y-3">
                      <p className="font-bold text-slate-300">{qIdx + 1}. {q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectOption(qIdx, optIdx)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg border text-[11px] font-semibold transition-all ${
                              quizAnswers[qIdx] === optIdx
                                ? "bg-primary border-primary text-white shadow-glow"
                                : "bg-slate-950/40 border-border text-secondary hover:text-foreground"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4 border-t border-border">
                    <button
                      onClick={() => handleSubmitQuiz(selectedCourse)}
                      disabled={Object.keys(quizAnswers).length < selectedCourse.quizQuestions.length}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      Submit Exam <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  {quizPassed ? (
                    <div className="space-y-3">
                      <Trophy size={48} className="text-amber-400 mx-auto" />
                      <h4 className="font-extrabold text-base text-primary">Congratulations! You Passed!</h4>
                      <p className="text-secondary max-w-sm mx-auto">
                        You scored <span className="font-extrabold text-teal-400">{quizScore}%</span>. Your credentials and continuing medical education credits have been logged.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Award size={48} className="text-red-400 mx-auto" />
                      <h4 className="font-extrabold text-base text-primary">Exam Not Passed</h4>
                      <p className="text-secondary max-w-sm mx-auto">
                        You scored <span className="font-extrabold text-red-400">{quizScore}%</span> (Minimum required to pass: 70%). Please review the course materials and try again.
                      </p>
                      <button
                        onClick={() => handleStartQuiz(selectedCourse.id)}
                        className="px-4 py-2 bg-slate-800 text-teal-400 font-bold border border-teal-500/20 rounded-lg hover:bg-slate-900"
                      >
                        Retry Exam
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course) => (
                <div key={course.id} className="border border-border/80 rounded-2xl p-5 bg-slate-900/10 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="bg-slate-900 border border-border px-2 py-0.5 rounded text-secondary font-bold uppercase">{course.category}</span>
                      <span className="text-secondary flex items-center gap-1"><Clock size={11} /> {course.duration}</span>
                    </div>
                    <h4 className="font-bold text-sm text-primary leading-snug">{course.title}</h4>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-secondary font-semibold">
                        <span>Course Progress</span>
                        <span>{course.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div className="bg-teal-500 h-1 rounded-full" style={{ width: `${course.progress}%` }} />
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartQuiz(course.id)}
                      className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                        course.completed
                          ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
                          : "bg-primary hover:bg-primary-hover text-white shadow-sm"
                      }`}
                    >
                      {course.completed ? (
                        <>
                          <CheckCircle size={13} /> Certified
                        </>
                      ) : (
                        <>
                          Start Exam <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Certifications Dashboard Panel */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Award size={16} className="text-teal-400" />
          Active Credentials
        </h4>

        <div className="space-y-3">
          {certifications.map((cert) => (
            <div key={cert.id} className="border border-border rounded-xl p-4 bg-slate-900/10 space-y-2">
              <div className="flex items-center gap-1.5 text-teal-400 font-bold">
                <Award size={14} /> Certified Professional
              </div>
              <h5 className="font-bold text-primary">{cert.courseTitle}</h5>
              <div className="space-y-1 text-slate-300 text-[10px] pt-1.5 border-t border-border/40">
                <p><span className="font-bold text-secondary">Earned Date:</span> {cert.certifiedDate}</p>
                <p><span className="font-bold text-secondary">Score:</span> {cert.score}%</p>
                <p className="truncate font-mono" title={cert.certHash}>
                  <span className="font-bold text-secondary font-sans block">Credential Hash:</span>
                  {cert.certHash}
                </p>
              </div>
            </div>
          ))}

          {certifications.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              No certifications earned yet. Complete quizzes to earn credentials.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
