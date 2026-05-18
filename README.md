# 🚀 Enterprise Goal Management & Performance Tracking Portal

> A modern enterprise-grade Goal Setting, KPI Tracking, Approval, Escalation, and Performance Management platform built for the **AtomQuest Hackathon 1.0**.

---

# 🌟 Overview

This project is a complete web-based Goal Management & Performance Tracking system designed to streamline organizational performance workflows.

The platform enables:

* Employees to create and track goals
* Managers to review and approve goals
* HR/Admins to monitor organization-wide performance
* Automated escalation workflows
* Quarterly performance check-ins
* KPI alignment across teams and departments

The system is inspired by enterprise HRMS/performance platforms such as:

* Workday
* SAP SuccessFactors
* Oracle HCM
* Microsoft Viva Goals

---

# ✨ Core Features

## 👨‍💼 Employee Module

Employees can:

* Create personal goals
* Save goals as drafts
* Submit goals for approval
* Update quarterly achievements
* Track performance progress
* View locked approved goals
* Receive reminders and escalation alerts

### Goal Rules

* Maximum 8 goals
* Minimum 10% weightage per goal
* Total weightage must equal exactly 100%

---

## 👨‍💻 Manager (L1) Module

Managers can:

* Review employee goals
* Approve or reject submissions
* Edit targets/weightages before approval
* Conduct quarterly check-ins
* Add performance comments & feedback
* Monitor team-level performance
* Create and assign shared departmental KPIs

### Shared Goal Functionality

Managers can push department KPIs to multiple employees.

Employees can:

* Adjust only weightage

Employees cannot:

* Edit KPI title
* Edit KPI target

---

## 🛡️ Admin / HR Module

Admins/HR can:

* Manage organization hierarchy
* Assign employees to managers
* Configure review cycles
* Unlock approved goals
* Monitor completion rates
* Access audit logs
* Generate reports & analytics
* Create organization-wide KPIs

---

# 🧠 Enterprise Workflow

```text
Admin / HR
      ↓
Manager (L1)
      ↓
Employees
```

---

# 🔄 Goal Lifecycle Flow

```text
Create Goal
↓
Save Draft
↓
Submit Goal Sheet
↓
Manager Review
↓
Approve / Reject
↓
Goal Locked
↓
Quarterly Updates
↓
Manager Check-ins
↓
Performance Tracking
```

---

# 🏢 Organization Hierarchy Logic

The platform implements a real enterprise reporting hierarchy.

* Every employee is mapped to a manager
* Managers only view their own team
* Admins have organization-wide visibility
* Goal approvals are routed automatically
* Employees never manually choose managers

---

# 🔐 Role-Based Access Control (RBAC)

The application implements enterprise-grade RBAC.

## Employee Access

Can access:

* Own goals
* Own dashboard
* Quarterly updates

Cannot access:

* Manager approvals
* Admin controls
* Other employees

---

## Manager Access

Can access:

* Team dashboard
* Team approvals
* Team performance
* Check-ins

Cannot access:

* Organization governance
* HR controls
* Global reports

---

## Admin Access

Can access:

* Full organization data
* Reports
* Audit logs
* User management
* Goal unlocks
* Escalation monitoring

---

# ⚡ Escalation & Automation System

The platform includes automated workflow escalation logic.

## Supported Escalations

* Employee goal submission delays
* Manager approval delays
* Quarterly check-in delays

## Escalation Chain

```text
Employee Reminder
↓
Manager Notification
↓
HR/Admin Escalation
```

---

# 📊 Quarterly Performance Tracking

Employees submit quarterly updates:

* Q1
* Q2
* Q3
* Q4

Managers conduct check-ins and track:

* Planned vs Actual achievement
* Goal completion progress
* Team performance trends

---

# 📈 Progress Calculation Logic

The system supports multiple Unit of Measurement (UoM) types.

| UoM Type                   | Logic                       |
| -------------------------- | --------------------------- |
| Numeric (Higher is Better) | Achievement ÷ Target        |
| Numeric (Lower is Better)  | Target ÷ Achievement        |
| Timeline                   | Completion Date vs Deadline |
| Zero-Based                 | 0 = Success                 |

---

# 🔔 Notification Architecture

| Channel   | Provider          | Usage                                              |
| --------- | ----------------- | -------------------------------------------------- |
| Emails    | Resend API        | Goal approvals, rejections, escalations, reminders |
| Slack     | Incoming Webhooks | Team/channel notifications                         |
| In-App    | Supabase Table    | Notification bell system                           |
| Cron Jobs | Vercel Cron       | Automated reminder workflows                       |

---

# 🔐 Authentication Flow

| Step | Action                              | Service               |
| ---- | ----------------------------------- | --------------------- |
| 1    | User authenticates via Email/Google | Firebase Client SDK   |
| 2    | Client sends token for verification | Next.js Route Handler |
| 3    | Token verification & UID extraction | Firebase Admin SDK    |
| 4    | Session & user profile sync         | Supabase + Next.js    |

---

# 🛠️ Tech Stack

## Frontend

* Next.js
* Tailwind CSS
* Responsive Enterprise UI

## Backend

* Next.js Route Handlers
* REST APIs
* Webhook Architecture

## Authentication

* Firebase Authentication
* Google SSO

## Database

* Supabase PostgreSQL

## Deployment

* Vercel

## Notifications

* Resend API
* Slack Webhooks
* Vercel Cron Jobs

---

# 🏗️ Architecture Overview

```text
Users
   ↓
Next.js Frontend
   ↓
Next.js Route Handlers / APIs
   ↓
Supabase Database
   ↓
Notification & Escalation Services
```

---

# 📂 Major Modules

## Employee Dashboard

* Goal Creation
* Goal Tracking
* Quarterly Updates
* Progress Monitoring

## Manager Dashboard

* Team Goals
* Pending Approvals
* Team Analytics
* Check-ins & Feedback

## Admin Dashboard

* User Management
* Organization Monitoring
* Audit Logs
* Reports & Governance

---

# 📋 Validation Rules

The platform enforces:

* Maximum 8 goals per employee
* Minimum 10% weightage per goal
* Total weightage must equal 100%
* Locked goals cannot be edited
* Unauthorized routes are blocked

---

# 📊 Features Implemented

✅ Goal Creation & Management

✅ Goal Approval Workflow

✅ Quarterly Check-ins

✅ Role-Based Access Control

✅ Enterprise Reporting Hierarchy

✅ Shared Department KPIs

✅ Goal Locking System

✅ Escalation Workflow

✅ Notification System

✅ Dashboard Analytics

✅ Progress Tracking

✅ Authentication & Authorization

✅ Responsive Enterprise UI

---

# 🚀 Deployment

## Live Demo

```text
atomquest-hack-one.vercel.app
```

# 🔑 Demo Credentials

## Employee

```text
Email: employee@test.com
Password: 123456
```

## Manager

```text
Email: manager@test.com
Password: 123456
```

## Admin / HR

```text
Email: admin@test.com
Password: 123456
```

---

# 🎯 Future Enhancements

* Microsoft Entra ID Integration
* Advanced Analytics Dashboard
* AI-Based Performance Insights
* Microsoft Teams Integration
* Mobile Application Support
* Advanced Workflow Engine

---

# 🏆 Hackathon Objective

This project was developed as part of:

## AtomQuest Hackathon 1.0

Goal:

Build a scalable enterprise-grade Goal Setting & Tracking Portal capable of handling:

* Organizational hierarchy
* Goal alignment
* KPI tracking
* Quarterly performance reviews
* Governance workflows
* Automated escalation systems


# 📄 License

This project is intended for hackathon/demo purposes.
