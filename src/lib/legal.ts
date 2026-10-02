import type { SupportedLanguage } from './i18n';

export type LegalDoc = 'privacy' | 'terms';
export interface LegalSection {
  heading: string;
  body: string[];
}

export const LEGAL_UPDATED = '2026-10-01';

type Content = Record<LegalDoc, LegalSection[]>;

const en: Content = {
  privacy: [
    {
      heading: 'No privacy guarantee',
      body: [
        'Qrilly is a hobby-grade tool provided as is. The developer does not guarantee the privacy, confidentiality, integrity or availability of any data you enter, and accepts no responsibility of any kind for it. Use it only if you accept this.',
      ],
    },
    {
      heading: 'What is stored',
      body: [
        'Account: your name, email address and a hashed password.',
        'Content you create: sender presets (business name, address, IBAN, logo, numbering), clients, logged hours and invoices, including the names, addresses and email addresses of the people you bill.',
        'Technical data: a session cookie that keeps you signed in, and your language and colour-mode choice kept in your browser. There are no advertising or analytics trackers.',
      ],
    },
    {
      heading: 'Where it is stored and who can see it',
      body: [
        'Everything is stored in a cloud database (MongoDB Atlas), not locally, and the app is run by other third-party providers (hosting and email delivery). Those providers, and whoever administers the database, can access what is stored there.',
        'Only some data is encrypted: client and invoice personal details (names, emails, addresses, notes, line-item text). Everything else - your account name and email, your sender presets including the IBAN, amounts, dates, invoice numbers, quantities and group names - is stored in plain, readable form, so the database administrator can see it. The encryption key is held by the service itself, so even encrypted data can be accessed by whoever controls it. Passwords are the only thing stored hashed.',
        'Data may be processed on servers outside Switzerland.',
      ],
    },
    {
      heading: 'Emails',
      body: [
        'When you ask the app to send an email (account confirmation, password reset, an invoice to your client), the recipient address and the message, including any attached invoice PDF, pass through an email delivery provider.',
      ],
    },
    {
      heading: 'Your control',
      body: [
        'You can download all your data and delete your account from Settings. Deleted invoices stay in a trash for 15 days before being removed. Deleting is on you: keep your own backups and records.',
      ],
    },
    {
      heading: 'Responsibility',
      body: [
        'You are responsible for the data you enter, including the personal data of your clients, and for having the right to store it here. To the fullest extent permitted by law, the developer accepts no liability for any loss, leak, misuse or disclosure of data, whether caused by the developer, the providers, third parties or you.',
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
  privacy: [
    {
      heading: 'Nessuna garanzia di privacy',
      body: [
        'Qrilly è uno strumento amatoriale fornito così com’è. Lo sviluppatore non garantisce la privacy, la riservatezza, l’integrità o la disponibilità dei dati che inserisci e non si assume alcuna responsabilità al riguardo. Usalo solo se lo accetti.',
      ],
    },
    {
      heading: 'Cosa viene salvato',
      body: [
        'Account: nome, indirizzo email e una password sotto forma di hash.',
        'Contenuti che crei: preset mittente (nome dell’attività, indirizzo, IBAN, logo, numerazione), clienti, ore registrate e fatture, compresi nomi, indirizzi ed email delle persone a cui fatturi.',
        'Dati tecnici: un cookie di sessione che ti mantiene connesso e la scelta di lingua e tema, salvate nel tuo browser. Non ci sono tracker pubblicitari o di analisi.',
      ],
    },
    {
      heading: 'Dove sono salvati e chi può vederli',
      body: [
        'Tutto è salvato in un database cloud (MongoDB Atlas), non in locale, e l’app è gestita da altri fornitori terzi (hosting e invio email). Questi fornitori, e chi amministra il database, possono accedere a ciò che vi è salvato.',
        'Solo alcuni dati sono cifrati: i dati personali di clienti e fatture (nomi, email, indirizzi, note, testo delle righe). Tutto il resto - nome ed email dell’account, preset mittente compreso l’IBAN, importi, date, numeri di fattura, quantità e nomi dei gruppi - è salvato in chiaro, quindi l’amministratore del database può vederlo. La chiave di cifratura è custodita dal servizio stesso, quindi anche i dati cifrati sono accessibili a chi lo controlla. Le password sono l’unica cosa salvata con hash.',
        'I dati possono essere trattati su server fuori dalla Svizzera.',
      ],
    },
    {
      heading: 'Email',
      body: [
        'Quando chiedi all’app di inviare un’email (conferma dell’account, reimpostazione della password, una fattura al tuo cliente), l’indirizzo del destinatario e il messaggio, compreso l’eventuale PDF allegato, passano da un servizio di invio email.',
      ],
    },
    {
      heading: 'Il tuo controllo',
      body: [
        'Puoi scaricare tutti i tuoi dati ed eliminare l’account da Impostazioni. Le fatture eliminate restano 15 giorni nel cestino prima di essere rimosse. Eliminare spetta a te: conserva i tuoi backup e i tuoi registri.',
      ],
    },
    {
      heading: 'Responsabilità',
      body: [
        'Sei responsabile dei dati che inserisci, compresi i dati personali dei tuoi clienti, e di avere il diritto di salvarli qui. Nella misura massima consentita dalla legge, lo sviluppatore non si assume alcuna responsabilità per perdita, fuga, uso improprio o divulgazione dei dati, sia causati dallo sviluppatore, dai fornitori, da terzi o da te.',
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
