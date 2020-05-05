FROM amazonlinux:2018.03

RUN yum update -y
RUN yum install -y tar gzip git
RUN yum groupinstall 'Development Tools' -y

RUN curl --silent --location https://rpm.nodesource.com/setup_10.x | bash -
RUN yum -y install nodejs gcc-c++ make
RUN npm install -g runjs node-gyp node-pre-gyp
RUN npm install -g https://github.com/fromkeith/runlam.git#f45b3b630fdf2f70b1ee5daa45c2bd14949a113c

