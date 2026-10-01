import type { SupportedLanguage } from './i18n';

export type LegalDoc = 'privacy' | 'terms' | 'imprint';
export interface LegalSection {
  heading: string;
  body: string[];
}

export const LEGAL_UPDATED = '2026-10-01';

/**
 * Who runs this instance. Set these in the environment; the placeholders make
 * it obvious on the page if they were forgotten.
 */
export const OPERATOR = {
  name: process.env.NEXT_PUBLIC_LEGAL_NAME || '[Operator name]',
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || '[Street, ZIP City, Switzerland]',
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || '[contact email]',
};

type Content = Record<LegalDoc, LegalSection[]>;

const en: Content = {
  imprint: [
    {
      heading: 'Operator',
      body: [`${OPERATOR.name}`, `${OPERATOR.address}`, `Email: ${OPERATOR.email}`],
    },
    {
      heading: 'About this service',
      body: [
        'Qrilly is a tool for creating Swiss QR-bill invoices. The operator does not review the invoices created with it and is not a party to the contracts between users and their clients.',
      ],
    },
  ],
  privacy: [
    {
      heading: 'Who is responsible',
      body: [
        `${OPERATOR.name}, ${OPERATOR.address} ("we"), operates Qrilly. Contact for any privacy question: ${OPERATOR.email}.`,
        'This policy follows the Swiss Federal Act on Data Protection (nFADP/nDSG).',
      ],
    },
    {
      heading: 'What we store',
      body: [
        'Account: your name, email address and a hashed password (we never store the password itself).',
        'Content you create: sender presets (your business name, address, IBAN, logo, numbering), clients, logged hours and invoices, including the names, addresses and email addresses of the people you bill.',
        'Technical data: a session cookie that keeps you signed in, and your language and colour-mode choice kept in your browser. We do not use advertising or analytics trackers.',
      ],
    },
    {
      heading: 'Why we use it',
      body: [
        'Only to run the service: to sign you in, to build and store your invoices and rebuild their PDFs, and to send the emails you ask for (confirmation, password reset, invoices).',
      ],
    },
    {
      heading: 'How it is protected',
      body: [
        'Passwords are stored hashed. Client and invoice personal details are encrypted at rest with a key per account, itself protected by a server-held master key; other data (such as your presets, amounts and dates) is stored readable. See the Terms of use for the exact list. Connections use HTTPS.',
        'Encryption at rest protects against a leak of the database alone; it does not hide your data from the operator of the service, who holds the master key.',
      ],
    },
    {
      heading: 'Who else processes it',
      body: [
        'We use service providers to run Qrilly: a hosting provider (Vercel), a database provider (MongoDB Atlas) and an email delivery provider (Resend). They process data on our behalf and may do so outside Switzerland, under appropriate safeguards.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Until you delete it (deleted invoices stay in a trash for 15 days first). You can delete your account and all its data yourself under Settings. As the issuer of invoices you are responsible for meeting your own bookkeeping retention duties (generally 10 years in Switzerland) - export your data before deleting.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can access and download your data (Settings, "Export your data"), correct it in the app, and delete it (Settings, "Delete account"). For anything else, or to complain, write to us. You may also contact the Federal Data Protection and Information Commissioner (FDPIC).',
      ],
    },
  ],
  terms: [
    {
      heading: 'What Qrilly is',
      body: [
        'Qrilly is a free tool for creating, storing and sending Swiss QR-bill invoices. Using it is entirely optional and your own choice. By creating an account or using the service you accept these terms; if you do not accept them, please do not use it.',
      ],
    },
    {
      heading: 'You are responsible for your use and your data',
      body: [
        'You alone decide what you enter and what you do with it. You are solely responsible for the accuracy and legality of everything you provide - your payment details and IBAN, amounts, VAT rates, invoice contents, and the personal data of your clients - and for the invoices you create, send, cancel or delete.',
        'You confirm that you are entitled to process the personal data of the people you enter, and that you meet your own legal duties as an invoice issuer (bookkeeping, VAT, data protection, record retention).',
        'Check every invoice and its QR bill before you rely on it. Qrilly does not review your invoices and is not a party to any contract or payment between you and your clients.',
      ],
    },
    {
      heading: 'Where your data is stored',
      body: [
        'Your data is stored in the cloud, in a MongoDB Atlas database cluster operated by a third-party provider - not on your device and not on a local database. The service is hosted by further third-party providers (see the Privacy policy). Their availability, security and location are outside the publisher’s control.',
      ],
    },
    {
      heading: 'How your data is protected (encrypted, not hashed)',
      body: [
        'Passwords are hashed (a one-way transformation): the publisher cannot read them back and never stores them in plain text.',
        'Your clients’ and invoices’ personal details are encrypted (AES-256-GCM, reversible with a key) before being written to the database: client names, emails, addresses and notes; invoice recipient names, emails and addresses, group titles, line-item descriptions, messages and notes; and the notes on logged hours. Each account has its own key, which is in turn protected by a master key held by the service.',
        'Not everything is encrypted: your account name and email, your sender presets (business name, address, IBAN, logo, numbering and defaults), amounts, dates, invoice numbers, quantities and group names are stored as normal readable data, because the service needs them to work.',
        'Because the service holds the keys it needs to display and rebuild your invoices, encryption protects against a leak of the database on its own; it is not end-to-end encryption and does not prevent the service itself from technically accessing your data.',
        'No system is perfectly secure. Do not store anything you are not prepared to risk.',
      ],
    },
    {
      heading: 'Deleting and restoring',
      body: [
        'A deleted invoice is kept in a trash for 15 days, during which you can restore it; after that it is removed permanently together with the hours it billed. An invoice already marked as paid cannot be deleted. You can delete your whole account at any time under Settings, and download all your data before you do.',
        'Keep your own backups and records: the publisher does not guarantee that data will never be lost, altered or unavailable.',
      ],
    },
    {
      heading: 'No warranty and no liability',
      body: [
        'The service is provided "as is" and "as available", without warranty of any kind - including that it is error-free, uninterrupted, secure, suitable for your purpose, or that generated QR bills will be accepted by every bank or payment app.',
        'To the fullest extent permitted by law, the developer and publisher of Qrilly accept no liability whatsoever for any loss or damage arising from the use of, or inability to use, the service - including lost or incorrect data, wrong or unpaid invoices, lost income, tax or accounting consequences, claims by your clients or third parties, or data breaches at the underlying providers. Where liability cannot be excluded by mandatory law, it is limited to the minimum the law requires.',
      ],
    },
    {
      heading: 'Accounts, changes and law',
      body: [
        'Keep your password secret. Accounts used for spam, fraud or that put the service at risk may be suspended or removed, and the service may be changed or discontinued at any time.',
        'We may update these terms; the date below shows the latest version, and continuing to use the service means you accept it. Swiss law applies.',
      ],
    },
  ],
};

const it: Content = {
  imprint: [
    {
      heading: 'Gestore',
      body: [`${OPERATOR.name}`, `${OPERATOR.address}`, `Email: ${OPERATOR.email}`],
    },
    {
      heading: 'Informazioni sul servizio',
      body: [
        'Qrilly è uno strumento per creare fatture con polizza di versamento QR svizzera. Il gestore non controlla le fatture create e non è parte dei contratti tra gli utenti e i loro clienti.',
      ],
    },
  ],
  privacy: [
    {
      heading: 'Responsabile',
      body: [
        `${OPERATOR.name}, ${OPERATOR.address} («noi»), gestisce Qrilly. Contatto per qualsiasi domanda sulla privacy: ${OPERATOR.email}.`,
        'Questa informativa si basa sulla Legge federale sulla protezione dei dati (LPD).',
      ],
    },
    {
      heading: 'Cosa conserviamo',
      body: [
        'Account: nome, indirizzo email e una password sotto forma di hash (non conserviamo mai la password in chiaro).',
        'Contenuti che crei: preset mittente (nome dell’attività, indirizzo, IBAN, logo, numerazione), clienti, ore registrate e fatture, compresi nomi, indirizzi ed email delle persone a cui fatturi.',
        'Dati tecnici: un cookie di sessione che ti mantiene connesso e la scelta di lingua e tema, salvate nel tuo browser. Non usiamo tracker pubblicitari o di analisi.',
      ],
    },
    {
      heading: 'Perché li usiamo',
      body: [
        'Solo per far funzionare il servizio: farti accedere, creare e conservare le fatture e ricreare i PDF, e inviare le email che richiedi (conferma, reimpostazione password, fatture).',
      ],
    },
    {
      heading: 'Come sono protetti',
      body: [
        'Le password sono salvate con hash. I dati personali di clienti e fatture sono cifrati a riposo con una chiave per account, a sua volta protetta da una chiave principale custodita dal server; gli altri dati (come preset, importi e date) sono salvati in forma leggibile. Vedi le Condizioni d’uso per l’elenco esatto. Le connessioni usano HTTPS.',
        'La cifratura a riposo protegge da una fuga del solo database; non nasconde i dati al gestore del servizio, che possiede la chiave principale.',
      ],
    },
    {
      heading: 'Chi altro li tratta',
      body: [
        'Per far funzionare Qrilly ci avvaliamo di fornitori: un servizio di hosting (Vercel), un database (MongoDB Atlas) e un servizio di invio email (Resend). Trattano i dati per nostro conto e possono farlo anche fuori dalla Svizzera, con garanzie adeguate.',
      ],
    },
    {
      heading: 'Per quanto tempo',
      body: [
        'Finché non li elimini (le fatture eliminate restano 15 giorni nel cestino). Puoi eliminare l’account e tutti i dati da solo in Impostazioni. Come emittente di fatture sei responsabile del rispetto dei tuoi obblighi di conservazione contabile (in Svizzera in genere 10 anni) - esporta i dati prima di eliminarli.',
      ],
    },
    {
      heading: 'I tuoi diritti',
      body: [
        'Puoi accedere ai tuoi dati e scaricarli (Impostazioni, «Esporta i tuoi dati»), correggerli nell’app ed eliminarli (Impostazioni, «Elimina account»). Per il resto, o per un reclamo, scrivici. Puoi anche rivolgerti all’Incaricato federale della protezione dei dati e della trasparenza (IFPDT).',
      ],
    },
  ],
  terms: [
    {
      heading: 'Che cos’è Qrilly',
      body: [
        'Qrilly è uno strumento gratuito per creare, conservare e inviare fatture con polizza QR svizzera. Il suo uso è del tutto facoltativo e una tua scelta. Creando un account o usando il servizio accetti queste condizioni; se non le accetti, non usarlo.',
      ],
    },
    {
      heading: 'Sei responsabile del tuo uso e dei tuoi dati',
      body: [
        'Sei tu solo a decidere cosa inserire e cosa farne. Sei l’unico responsabile dell’esattezza e della liceità di tutto ciò che fornisci - coordinate di pagamento e IBAN, importi, aliquote IVA, contenuto delle fatture e dati personali dei tuoi clienti - e delle fatture che crei, invii, annulli o elimini.',
        'Confermi di essere autorizzato a trattare i dati personali delle persone che inserisci e di rispettare i tuoi obblighi di legge come emittente di fatture (contabilità, IVA, protezione dei dati, conservazione dei documenti).',
        'Controlla ogni fattura e la sua polizza QR prima di farci affidamento. Qrilly non verifica le tue fatture e non è parte di alcun contratto o pagamento tra te e i tuoi clienti.',
      ],
    },
    {
      heading: 'Dove sono salvati i dati',
      body: [
        'I tuoi dati sono salvati nel cloud, in un cluster di database MongoDB Atlas gestito da un fornitore terzo - non sul tuo dispositivo e non in un database locale. Il servizio è ospitato da altri fornitori terzi (vedi l’Informativa sulla privacy). La loro disponibilità, sicurezza e ubicazione sono fuori dal controllo dell’editore.',
      ],
    },
    {
      heading: 'Come sono protetti i dati (cifrati, non hash)',
      body: [
        'Le password sono sottoposte a hash (trasformazione a senso unico): l’editore non può rileggerle e non le conserva mai in chiaro.',
        'I dati personali di clienti e fatture sono cifrati (AES-256-GCM, reversibile con una chiave) prima di essere scritti nel database: nomi, email, indirizzi e note dei clienti; nomi, email e indirizzi dei destinatari delle fatture, titoli dei gruppi, descrizioni delle righe, messaggi e note; e le note delle ore registrate. Ogni account ha una propria chiave, a sua volta protetta da una chiave principale custodita dal servizio.',
        'Non tutto è cifrato: nome ed email dell’account, preset mittente (nome dell’attività, indirizzo, IBAN, logo, numerazione e valori predefiniti), importi, date, numeri di fattura, quantità e nomi dei gruppi sono salvati come normali dati leggibili, perché il servizio ne ha bisogno per funzionare.',
        'Poiché il servizio possiede le chiavi necessarie per mostrare e ricreare le tue fatture, la cifratura protegge dalla fuga del solo database; non è una cifratura end-to-end e non impedisce al servizio stesso di accedere tecnicamente ai tuoi dati.',
        'Nessun sistema è perfettamente sicuro. Non salvare nulla che non sei disposto a rischiare.',
      ],
    },
    {
      heading: 'Eliminazione e ripristino',
      body: [
        'Una fattura eliminata resta nel cestino per 15 giorni, durante i quali puoi ripristinarla; dopo viene rimossa definitivamente insieme alle ore che fatturava. Una fattura già segnata come pagata non può essere eliminata. Puoi eliminare l’intero account in qualsiasi momento da Impostazioni e scaricare prima tutti i tuoi dati.',
        'Conserva i tuoi backup e i tuoi registri: l’editore non garantisce che i dati non vengano mai persi, alterati o resi non disponibili.',
      ],
    },
    {
      heading: 'Nessuna garanzia e nessuna responsabilità',
      body: [
        'Il servizio è fornito «così com’è» e «come disponibile», senza garanzie di alcun tipo - compreso che sia privo di errori, ininterrotto, sicuro, adatto al tuo scopo, o che le polizze QR generate siano accettate da ogni banca o app di pagamento.',
        'Nella misura massima consentita dalla legge, lo sviluppatore e l’editore di Qrilly non assumono alcuna responsabilità per perdite o danni derivanti dall’uso o dall’impossibilità di usare il servizio - inclusi dati persi o errati, fatture sbagliate o non pagate, mancati guadagni, conseguenze fiscali o contabili, pretese di tuoi clienti o di terzi, o violazioni dei dati presso i fornitori sottostanti. Dove la responsabilità non può essere esclusa da norme imperative, è limitata al minimo richiesto dalla legge.',
      ],
    },
    {
      heading: 'Account, modifiche e diritto applicabile',
      body: [
        'Tieni segreta la password. Gli account usati per spam o frodi, o che mettono a rischio il servizio, possono essere sospesi o rimossi, e il servizio può essere modificato o interrotto in qualsiasi momento.',
        'Possiamo aggiornare queste condizioni; la data qui sotto indica l’ultima versione e continuare a usare il servizio significa accettarla. Si applica il diritto svizzero.',
      ],
    },
  ],
};

export const LEGAL_CONTENT: Record<SupportedLanguage, Content> = { en, it };
